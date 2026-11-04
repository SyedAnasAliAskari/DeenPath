package org.salahguard.app

import android.app.Activity
import android.graphics.*
import android.graphics.pdf.PdfRenderer
import android.os.Bundle
import android.os.ParcelFileDescriptor
import android.view.*
import android.widget.*
import java.io.File

/** System PdfRenderer: private, offline, paginated, bounded bitmap memory. */
class PdfActivity : Activity() {
  private lateinit var renderer: PdfRenderer
  private lateinit var path: String
  private var page = 0
  private var zoom = 1f
  private var bitmap: Bitmap? = null
  private lateinit var image: ImageView
  private lateinit var title: TextView
  private lateinit var vertical: ScrollView

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    try {
      path = intent.getStringExtra("path") ?: error("No document")
      val file = File(path).canonicalFile
      require(file.parentFile == File(filesDir, "documents").canonicalFile)
      renderer = PdfRenderer(ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY))
      page = intent.getIntExtra("page", 0).coerceIn(0, renderer.pageCount - 1)
      zoom =
        LocalDatabase(this)
          .use { it.meta("pdf:$path:zoom")?.toFloatOrNull() ?: 1f }
          .coerceIn(.5f, 2.5f)
      val savedOffset = LocalDatabase(this).use { it.meta("pdf:$path:scroll")?.toIntOrNull() ?: 0 }
      val settings = NotificationAudio.settings(this)
      val dark =
        settings.optString("appearance") == "dark" ||
          (settings.optString("appearance", "system") == "system" &&
            (resources.configuration.uiMode and
              android.content.res.Configuration.UI_MODE_NIGHT_MASK) ==
              android.content.res.Configuration.UI_MODE_NIGHT_YES)
      val ink = if (dark) Color.rgb(237, 242, 232) else Color.DKGRAY
      val layout =
        LinearLayout(this).apply {
          orientation = LinearLayout.VERTICAL
          setBackgroundColor(if (dark) Color.rgb(16, 34, 27) else Color.rgb(245, 245, 238))
        }
      val controls = LinearLayout(this)
      fun button(text: String, click: () -> Unit) {
        controls.addView(
          Button(this).apply {
            this.text = text
            setTextColor(ink)
            backgroundTintList =
              android.content.res.ColorStateList.valueOf(
                if (dark) Color.rgb(33, 58, 45) else Color.rgb(239, 245, 238)
              )
            val labels = listOf("previous", "next", "zoomOut", "zoomIn", "close", "complete")
            val index =
              when (text) {
                "<" -> 0
                else -> -1
              }
            contentDescription =
              NativeUi.text(
                this@PdfActivity,
                when (text.codePointAt(0)) {
                  8249 -> "previous"
                  8250 -> "next"
                  8722 -> "zoomOut"
                  43 -> "zoomIn"
                  215 -> "close"
                  else -> "complete"
                },
              )
            minWidth = 0
            minimumWidth = 0
            setPadding(0, 0, 0, 0)
            layoutParams =
              LinearLayout.LayoutParams(
                (48 * resources.displayMetrics.density).toInt(),
                (48 * resources.displayMetrics.density).toInt(),
              )
            setOnClickListener { click() }
          }
        )
      }
      button("‹") {
        if (page > 0) {
          page--
          render()
        }
      }
      title =
        TextView(this).apply {
          setTextColor(ink)
          gravity = Gravity.CENTER
        }
      controls.addView(
        title,
        LinearLayout.LayoutParams(0, (48 * resources.displayMetrics.density).toInt(), 1f),
      )
      button("›") {
        if (page < renderer.pageCount - 1) {
          page++
          render()
        }
      }
      button("−") {
        zoom = (zoom - .25f).coerceAtLeast(.5f)
        render()
      }
      button("+") {
        zoom = (zoom + .25f).coerceAtMost(2.5f)
        render()
      }
      button("×") { finish() }
      val routineId = intent.getStringExtra("routineId")
      if (routineId != null)
        button("\u2713") {
          var earned=0
          try {
            LocalDatabase(this).use { db ->
              db.update { root ->
                val before=root.optJSONObject("economy")?.let{org.json.JSONObject(it.toString())}
                val routine =
                  NativeRecords.record(root, "routines", routineId) ?: error("Routine not found")
                require(!routine.optBoolean("deleted"))
                val data = routine.getJSONObject("data")
                val now = java.time.Instant.now()
                val period = RoutinePeriods.key(data, now, root.getJSONArray("records"))
                require(
                  now
                    .atZone(java.time.ZoneId.of(data.getString("timezone")))
                    .toLocalDate()
                    .toString() >= data.getString("startDate")
                )
                val id = "$routineId:$period"
                val existing = NativeRecords.record(root, "routine_completions", id)
                if (existing == null || existing.optBoolean("deleted"))
                  NativeRecords.put(
                    root,
                    "routine_completions",
                    id,
                    org.json
                      .JSONObject()
                      .put("routineId", routineId)
                      .put("period", period)
                      .put("completedAt", now.toString()),
                  )
                GemRules.reconcile(root)
                earned=CompletionRewards.earned(before,root.optJSONObject("economy"),"routine:$id")
                root
              }
            }
            NativeSignals.changed(this)
            BackgroundSync.enqueue(this)
            ReminderScheduler.suppressCompleted(this)
            Toast.makeText(this, CompletionRewards.receipt("Routine",earned), Toast.LENGTH_SHORT).show()
            finish()
          } catch (_: Exception) {
            Toast.makeText(this, NativeUi.text(this, "saveFailed"), Toast.LENGTH_LONG).show()
          }
        }
      layout.addView(controls)
      vertical = ScrollView(this)
      val horizontal = HorizontalScrollView(this)
      image =
        ImageView(this).apply {
          adjustViewBounds = true
          scaleType = ImageView.ScaleType.FIT_START
        }
      horizontal.addView(image)
      vertical.addView(horizontal)
      layout.addView(vertical, LinearLayout.LayoutParams(-1, 0, 1f))
      setContentView(layout)
      render()
      image.post { vertical.scrollTo(0, savedOffset) }
    } catch (e: Exception) {
      Toast.makeText(this, NativeUi.text(this, "readFailed"), Toast.LENGTH_LONG).show()
      finish()
    }
  }

  private fun render() {
    val p = renderer.openPage(page)
    val desired = (resources.displayMetrics.widthPixels * zoom).toInt()
    val displayHeight = (desired.toFloat() * p.height / p.width).toInt()
    val scale = minOf(desired.toFloat() / p.width, 1400f / p.width, 2000f / p.height)
    val width = maxOf(1, (p.width * scale).toInt())
    val height = maxOf(1, (p.height * scale).toInt())
    image.layoutParams = FrameLayout.LayoutParams(desired, displayHeight)
    image.scaleType = ImageView.ScaleType.FIT_XY
    val next = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    next.eraseColor(Color.WHITE)
    p.render(next, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
    p.close()
    image.setImageBitmap(next)
    bitmap?.recycle()
    bitmap = next
    title.text = "${page+1} / ${renderer.pageCount}"
    LocalDatabase(this).use {
      it.position(path, page)
      it.meta("pdf:$path:zoom", zoom.toString())
    }
  }

  override fun onPause() {
    if (::vertical.isInitialized && ::path.isInitialized)
      LocalDatabase(this).use { it.meta("pdf:$path:scroll", vertical.scrollY.toString()) }
    super.onPause()
  }

  override fun onDestroy() {
    if (::renderer.isInitialized) renderer.close()
    bitmap?.recycle()
    super.onDestroy()
  }
}
