package com.teffbeauty.exclusivo.v13;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends Activity {
    private static final String SITE_HOST = "cdn.jsdelivr.net";
    private static final String BASE_URL = "https://cdn.jsdelivr.net/gh/victormatheusdemello64-cell/teff-beauty@ef121855e2ad8980f6093acfaf04234bfdd7908d/web/";
    private static final String START_URL = BASE_URL + "index.html?v=19-vitrine-teff";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);
        cookieManager.removeAllCookies(null);
        cookieManager.flush();

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);

        webView.clearCache(true);
        webView.clearHistory();
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (SITE_HOST.equals(uri.getHost())) {
                    return false;
                }

                startActivity(new Intent(Intent.ACTION_VIEW, uri));
                return true;
            }
        });

        loadHostedHtml();
    }

    private void loadHostedHtml() {
        webView.loadDataWithBaseURL(
            BASE_URL,
            "<html><body style=\"font-family:sans-serif;padding:24px;color:#5b332d\"><h2>Teff Exclusivo</h2><p>Carregando loja...</p></body></html>",
            "text/html",
            "UTF-8",
            null
        );

        new Thread(() -> {
            HttpURLConnection connection = null;
            try {
                URL url = new URL(START_URL);
                connection = (HttpURLConnection) url.openConnection();
                connection.setUseCaches(false);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(15000);
                connection.setRequestProperty("Cache-Control", "no-cache");
                connection.setRequestProperty("Accept", "text/html");

                StringBuilder html = new StringBuilder();
                try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        html.append(line).append('\n');
                    }
                }

                runOnUiThread(() -> webView.loadDataWithBaseURL(BASE_URL, html.toString(), "text/html", "UTF-8", START_URL));
            } catch (Exception exception) {
                runOnUiThread(() -> webView.loadDataWithBaseURL(
                    BASE_URL,
                    "<html><body style=\"font-family:sans-serif;padding:24px;color:#5b332d\"><h2>Teff Exclusivo</h2><p>Nao foi possivel abrir a loja agora. Verifique a internet e tente novamente.</p></body></html>",
                    "text/html",
                    "UTF-8",
                    null
                ));
            } finally {
                if (connection != null) {
                    connection.disconnect();
                }
            }
        }).start();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }

        super.onBackPressed();
    }
}
