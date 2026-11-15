package com.yazterfranco.dinorefugio;

import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;
import android.view.View;
import android.webkit.ConsoleMessage;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Dino Refugio para Android: una ventana de navegador (WebView) que muestra el
 * juego guardado dentro de la app, así que funciona sin internet.
 *
 * Los archivos del juego están en assets/www y se sirven como si vinieran de
 * https://appassets.androidplatform.net/ : con una dirección https el juego
 * puede usar módulos, guardar la partida (localStorage) y dibujar en 3D.
 */
public class MainActivity extends Activity {
    private static final String TAG = "DinoRefugio";
    private static final String HOST = "appassets.androidplatform.net";
    private static final String BASE = "https://" + HOST + "/";
    private static final Map<String, String> TIPOS = new HashMap<>();

    static {
        TIPOS.put("html", "text/html");
        TIPOS.put("js", "text/javascript");
        TIPOS.put("mjs", "text/javascript");
        TIPOS.put("css", "text/css");
        TIPOS.put("json", "application/json");
        TIPOS.put("webmanifest", "application/manifest+json");
        TIPOS.put("svg", "image/svg+xml");
        TIPOS.put("png", "image/png");
        TIPOS.put("jpg", "image/jpeg");
        TIPOS.put("webp", "image/webp");
        TIPOS.put("woff2", "font/woff2");
    }

    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        web.setBackgroundColor(0xFF1D4A36);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // la partida se guarda en localStorage
        s.setDatabaseEnabled(true);            // caché de imágenes 3D (IndexedDB)
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setSupportZoom(false);
        s.setTextZoom(100);

        web.addJavascriptInterface(new Puente(), "DinoAndroid");
        web.setWebViewClient(new Cliente());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.i(TAG, m.messageLevel() + " " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        web.loadUrl(BASE + "index.html");
    }

    /** Sirve los archivos del juego desde la app y abre fuera los enlaces externos. */
    private class Cliente extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (!HOST.equals(uri.getHost())) return null; // p. ej. las tipografías: van por internet
            String path = uri.getPath();
            if (path == null || path.isEmpty() || path.endsWith("/")) path = (path == null ? "/" : path) + "index.html";
            if (path.contains("..")) return fallo(403, "Prohibido");
            String ext = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT) : "";
            String tipo = TIPOS.get(ext);
            if (tipo == null) tipo = "application/octet-stream";
            boolean texto = tipo.startsWith("text/") || tipo.contains("json") || tipo.contains("svg");
            try {
                InputStream in = getAssets().open("www" + path);
                Map<String, String> cabeceras = new HashMap<>();
                cabeceras.put("Cache-Control", "no-cache");
                return new WebResourceResponse(tipo, texto ? "utf-8" : null, 200, "OK", cabeceras, in);
            } catch (IOException e) {
                return fallo(404, "No encontrado");
            }
        }

        private WebResourceResponse fallo(int codigo, String motivo) {
            InputStream vacio = new ByteArrayInputStream(motivo.getBytes(StandardCharsets.UTF_8));
            return new WebResourceResponse("text/plain", "utf-8", codigo, motivo, new HashMap<String, String>(), vacio);
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (HOST.equals(uri.getHost())) return false;
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (Exception e) {
                Toast.makeText(MainActivity.this, "No se pudo abrir el enlace.", Toast.LENGTH_SHORT).show();
            }
            return true;
        }
    }

    /** Funciones del teléfono que el juego puede pedir desde JavaScript. */
    private class Puente {
        @JavascriptInterface
        public String plataforma() {
            return "android";
        }

        /** Guarda una imagen PNG (la postal) en la galería y, si se pide, abre "Compartir". */
        @JavascriptInterface
        public void guardarImagen(final String nombre, final String base64, final boolean compartir) {
            final byte[] datos;
            try {
                datos = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                aviso("No se pudo crear la imagen.");
                return;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        Uri uri = escribirEnGaleria(nombre, datos);
                        if (uri == null) {
                            aviso("Postal guardada en los archivos de la app.");
                            return;
                        }
                        if (compartir) {
                            Intent enviar = new Intent(Intent.ACTION_SEND);
                            enviar.setType("image/png");
                            enviar.putExtra(Intent.EXTRA_STREAM, uri);
                            enviar.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivity(Intent.createChooser(enviar, "Compartir postal"));
                        } else {
                            aviso("Postal guardada en tu galería (Imágenes/DinoRefugio).");
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "No se pudo guardar la postal", e);
                        aviso("No se pudo guardar la imagen.");
                    }
                }
            });
        }
    }

    /** Devuelve la dirección de la imagen en la galería, o null si quedó solo en la carpeta de la app (Android 9 o anterior). */
    private Uri escribirEnGaleria(String nombre, byte[] datos) throws IOException {
        String archivo = nombre.replaceAll("[^\\p{L}\\p{N}._-]+", "-");
        if (!archivo.toLowerCase(Locale.ROOT).endsWith(".png")) archivo += ".png";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver r = getContentResolver();
            ContentValues v = new ContentValues();
            v.put(MediaStore.Images.Media.DISPLAY_NAME, archivo);
            v.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
            v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/DinoRefugio");
            Uri uri = r.insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IOException("sin galería");
            try (OutputStream out = r.openOutputStream(uri)) {
                if (out == null) throw new IOException("sin salida");
                out.write(datos);
            }
            return uri;
        }
        File carpeta = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
        if (carpeta == null) throw new IOException("sin almacenamiento");
        try (FileOutputStream out = new FileOutputStream(new File(carpeta, archivo))) {
            out.write(datos);
        }
        return null;
    }

    private void aviso(final String texto) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Toast.makeText(MainActivity.this, texto, Toast.LENGTH_LONG).show();
            }
        });
    }

    /** Botón Atrás: cierra la ventana abierta, vuelve a la pantalla anterior o sale. */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript(
            "(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",
            new android.webkit.ValueCallback<String>() {
                @Override
                public void onReceiveValue(String cerrado) {
                    if ("true".equals(cerrado)) return;
                    if (web.canGoBack()) web.goBack();
                    else finish();
                }
            });
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
