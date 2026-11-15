#!/usr/bin/env bash
# Instala el APK en el teléfono virtual, abre el juego, elige un huevo y
# guarda capturas y el registro de la consola. No detiene la compilación si
# algo falla: el resultado se revisa en la rama `apk`.
set -u
apk="$(ls android/app/build/outputs/apk/release/*.apk | head -1)"
pkg=com.yazterfranco.dinorefugio
{
  adb install -r "$apk"
  adb logcat -c
  adb shell am start -W -n "$pkg/.MainActivity"
  sleep 30
  adb exec-out screencap -p > pantalla-1-inicio.png
  # Toca el primer huevo (centro de la pantalla, zona de las tarjetas).
  tam="$(adb shell wm size | tr -d '\r' | awk '{print $3}')"
  ancho="${tam%x*}"; alto="${tam#*x}"
  adb shell input tap $((ancho / 2)) $((alto * 45 / 100))
  sleep 12
  adb exec-out screencap -p > pantalla-2-tras-tocar.png
  adb shell dumpsys package "$pkg" | grep -E "versionName|versionCode|targetSdk" | head -3
  adb shell dumpsys webviewupdate | grep -iE "current webview|version" | head -3
} > prueba.log 2>&1
adb logcat -d -s DinoRefugio:V chromium:W AndroidRuntime:E > consola.log 2>&1 || true
exit 0
