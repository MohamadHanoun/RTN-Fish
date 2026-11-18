# RTN Fish

لعبة أسئلة جماعية أونلاين بالعربي (2–10 لاعبين)، بفئات Gaming متنوعة، تخمين إجابات متسامح، وإعدادات للهوست ونظام ندرة ومكافآت.

## رفع اللعبة

نزّل ملف **RTN-Fish-Online.zip** المرفق في محادثة ChatGPT، وفك ضغطه.

من GitHub افتح هذا المستودع، ثم **Add file → Upload files** وارفع **الملفات والمجلدات داخل ZIP** وليس ملف ZIP نفسه. تأكد أن `server.js` و`package.json` و`render.yaml` تظهر في جذر المستودع، وأن `public/` و`data/` و`tests/` موجودة.

## تشغيلها

تحتاج Node.js 18 أو أحدث.

```bash
npm start
```

للاختبارات: `npm test`.

لنشرها على Render، استخدم خدمة **Web Service** بخطة Free، Runtime: Node، Build: `npm install`، Start: `npm start`، Health: `/health`، ومنطقة Frankfurt.

هذه لعبة مستقلة عن krillion.io، وليست نسخة من تصاميمه أو علامته التجارية.
