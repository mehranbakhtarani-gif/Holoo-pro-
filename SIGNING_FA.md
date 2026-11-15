# راه‌اندازی امضای پایدار HOLLOO PRO+

برای اینکه نسخه جدید روی نسخه نصب‌شده قبلی به‌روزرسانی شود، تمام نسخه‌های انتشار باید با **همان keystore** امضا شوند. فایل کلید را در مخزن Git قرار ندهید و آن را گم نکنید؛ از آن دو نسخه پشتیبان امن نگه دارید.

## ساخت کلید (فقط یک‌بار)
روی رایانه‌ای که Java JDK دارد اجرا کنید:

```bash
keytool -genkeypair -v -keystore holloo-release.jks -alias holloo -keyalg RSA -keysize 2048 -validity 10000
```

رمز keystore و رمز کلید را در جای امن نگه دارید. در پنجره پرسش‌های گواهی، مقادیر واقعی خود را وارد کنید.

## افزودن GitHub Actions Secrets
در GitHub: Settings → Secrets and variables → Actions → New repository secret

چهار Secret زیر را بسازید:
- `HOLLOO_KEYSTORE_BASE64`: خروجی Base64 فایل keystore. در Linux/macOS: `base64 -w 0 holloo-release.jks` (در macOS از `base64 holloo-release.jks | tr -d '\n'` استفاده کنید).
- `HOLLOO_STORE_PASSWORD`: رمز keystore
- `HOLLOO_KEY_ALIAS`: مقدار `holloo`
- `HOLLOO_KEY_PASSWORD`: رمز کلید

پس از ثبت این چهار Secret، اجرای بعدی workflow علاوه بر APK آزمایشی، APK انتشارِ امضاشده را نیز می‌سازد. اگر کلید قبلی نسخه‌ای که روی گوشی نصب است در دسترس نیست، کلید جدید نمی‌تواند آن نسخه را به‌روزرسانی کند؛ در آن حالت ابتدا باید نسخه قبلی حذف شود (با خطر از دست رفتن داده‌های محلی).
