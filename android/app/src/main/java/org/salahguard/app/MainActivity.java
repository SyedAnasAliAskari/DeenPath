package org.salahguard.app;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle state) {
        registerPlugin(SalahNativePlugin.class);
        super.onCreate(state);
        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override public void handleOnBackPressed() {
                getBridge().getWebView().evaluateJavascript(
                    "window.dispatchEvent(new CustomEvent('deenpath:back',{cancelable:true}))", null);
            }
        });
        route(getIntent());
    }
    @Override protected void onNewIntent(Intent intent) { super.onNewIntent(intent); setIntent(intent); route(intent); }
    private void route(Intent intent) {
        String reminder = intent.getStringExtra("reminder");
        if (reminder != null && !reminder.matches("prayer:\\d{4}-\\d{2}-\\d{2}:(Fajr|Dhuhr|Asr|Maghrib|Isha)|routine:[a-f0-9-]{36}|widget:(prayer|streak|garden|daily|gems|collection)|secretPenalty:recovery:[a-f0-9-]{36}:\\d{4}-\\d{2}-\\d{2}:0|private|journal")) return;
        if (reminder != null && getBridge() != null) {
            getBridge().getWebView().loadUrl("https://localhost/?reminder=" + Uri.encode(reminder));
        }
    }
}
