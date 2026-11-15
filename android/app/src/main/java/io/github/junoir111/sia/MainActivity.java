package io.github.junoir111.sia;

import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // SIA: no screenshots, no screen recording, no preview in the recent apps list.
        // Only a dedicated test build can turn this off (screen mirroring for development).
        if (protectionEnabled()) {
            getWindow().setFlags(
                WindowManager.LayoutParams.FLAG_SECURE,
                WindowManager.LayoutParams.FLAG_SECURE
            );
        }
    }

    private boolean protectionEnabled() {
        try {
            Bundle meta = getPackageManager()
                .getApplicationInfo(getPackageName(), PackageManager.GET_META_DATA)
                .metaData;
            return meta == null || !"false".equals(meta.getString("sia.screen_protection"));
        } catch (PackageManager.NameNotFoundException e) {
            return true;
        }
    }
}
