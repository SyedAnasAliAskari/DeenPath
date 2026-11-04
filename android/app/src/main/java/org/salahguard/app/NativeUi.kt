package org.salahguard.app

import android.content.Context

object NativeUi {
  fun text(c: Context, key: String): String {
    val lang = NotificationAudio.settings(c).optString("lang", "en")
    val entries =
      mapOf(
        "later" to
          listOf(
            "Remind me later",
            "\u0628\u0639\u062f \u0645\u06cc\u06ba \u06cc\u0627\u062f \u062f\u0644\u0627\u0626\u06cc\u06ba",
            "\u0630\u0643\u0631\u0646\u064a \u0644\u0627\u062d\u0642\u0627",
          ),
        "previous" to listOf("Previous page", "پچھلا صفحہ", "الصفحة السابقة"),
        "next" to listOf("Next page", "اگلا صفحہ", "الصفحة التالية"),
        "zoomIn" to listOf("Zoom in", "بڑا کریں", "تكبير"),
        "zoomOut" to listOf("Zoom out", "چھوٹا کریں", "تصغير"),
        "close" to listOf("Close reader", "مطالعہ بند کریں", "إغلاق القارئ"),
        "complete" to listOf("Complete routine", "معمول مکمل کریں", "إتمام الورد"),
        "saved" to
          listOf(
            "Completed and saved on this device",
            "مکمل ہو کر اس آلے پر محفوظ ہے",
            "اكتمل وحُفظ على هذا الجهاز",
          ),
        "saveFailed" to
          listOf(
            "Could not save. Please retry in DeenPath.",
            "محفوظ نہیں ہو سکا۔ صلاح گارڈ میں دوبارہ کوشش کریں۔",
            "تعذر الحفظ. أعد المحاولة في صلاح غارد.",
          ),
        "readFailed" to
          listOf("Could not open this document", "یہ دستاویز نہیں کھل سکی", "تعذر فتح هذا المستند"),
      )
    return entries[key]?.get(if (lang == "ur") 1 else if (lang == "ar") 2 else 0) ?: key
  }
}
