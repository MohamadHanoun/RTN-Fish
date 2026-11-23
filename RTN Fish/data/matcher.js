'use strict';
// A conservative Arabic/Dialect answer matcher. Avoids guessing on ambiguous partial words.
(function (root, factory) {
  const lib = factory();
  if (typeof module === 'object' && module.exports) module.exports = lib;
  else root.SamakaMatcher = lib;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function norm(s) {
    return String(s ?? '')
      .normalize('NFKC')
      .replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '')
      .replace(/[أإآٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ؤ/g, 'و')
      .replace(/ئ/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\+\+/g, ' plus plus ')
      .replace(/#/g, ' sharp ')
      .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 1776))
      .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 1632))
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim().toLowerCase();
  }
  function withoutAl(s) { return s.startsWith('ال') && s.length > 4 ? s.slice(2) : s; }
  function variants(s) { const normalized = norm(s); return [...new Set([normalized, withoutAl(normalized)])].filter(Boolean); }
  // Related colloquial and alternate names. The server and the standalone version use identical groups.
  const groups = [
    'طماطم|بندورة|بندوره', 'بطاطا|بطاطس|بطاطه', 'كوسا|كوسة|كوسه',
    'قرنبيط|زهرة|زهره', 'خس|خس اخضر', 'شمندر|بنجر', 'فطر|مشروم|عيش الغراب',
    'باذنجان|باتنجان', 'فاصولياء|فاصوليا', 'بازلاء|بسلة|بسله', 'فلفل|فليفلة|فليفله',
    'كمثرى|إجاص|اجاص|عرموط', 'برتقال|برئال', 'يوسفي|مندلينا|كلمنتينا',
    'بطيخ|جبس|رقي|جح', 'شمام|بطيخ اصفر', 'خوخ|دراق', 'مشمش|مشماش',
    'حليب|لبن حليب', 'لبن|زبادي|ياغورت', 'عيران|لبن عيران|شنينة|شنينه',
    'أرز|رز|تمن', 'مكرونة|معكرونة|مكارونة|مكرونه', 'فول سوداني|فستق عبيد',
    'آيس كريم|ايس كريم|بوظة|بوظه|جيلاتي', 'بطاطس مقلية|بطاطا مقلية|فرنش فرايز',
    'خبز|عيش', 'كوب|كاسة|كاس', 'صحن|طبق', 'قدر|طنجرة|حلة', 'مقلاة|طاسة',
    'ثلاجة|براد', 'مكيف|تكييف|مكيف هواء', 'غسالة|ماكينة غسيل',
    'مخدة|وسادة', 'بطانية|حرام', 'كنبة|أريكة|صوفا', 'خزانة|دولاب',
    'منشفة|فوطة|بشكير', 'سلة مهملات|سلة قمامة|زبالة', 'مجفف شعر|سشوار',
    'تواليت|مرحاض|حمام', 'صابون|صابونة', 'مغسلة|حوض غسيل',
    'هاتف|موبايل|جوال|تليفون|تلفون|محمول|موبايل فون',
    'هاتف ذكي|سمارت فون|جوال ذكي', 'حاسوب|كمبيوتر|كومبيوتر|بي سي|PC',
    'حاسوب محمول|لابتوب|لاب توب|لابتاب|نوت بوك', 'تابلت|جهاز لوحي|آيباد',
    'ماوس|فأرة|فارة', 'كيبورد|لوحة مفاتيح', 'سماعات|سماعة رأس|هيدفون',
    'ريموت|جهاز تحكم|جهاز تحكم عن بعد', 'باور بانك|شاحن متنقل|بطارية متنقلة',
    'فلاش|فلاشة|يو اس بي|USB', 'شاشة|مونيتور', 'كرت شاشة|بطاقة رسومات|جي بي يو|GPU',
    'راوتر|موجه|راوتر واي فاي', 'كرة قدم|فوتبول|فوتبول كرة قدم',
    'دراجة|بسكليت|بسكليته|بسكليتة|عجلة', 'حافلة|باص|اتوبيس|أتوبيس',
    'تاكسي|تكسي|سيارة أجرة', 'مروحية|هليكوبتر|طائرة عمودية',
    'سيارة|عربية|عرباية', 'شاحنة|لوري|ترلة', 'مترو|قطار أنفاق',
    'الولايات المتحدة|أمريكا|امريكا|الولايات المتحدة الأمريكية|USA',
    'المملكة المتحدة|بريطانيا|UK', 'الإمارات|الإمارات العربية المتحدة|الامارات',
    'السعودية|المملكة العربية السعودية', 'سوريا|سورية', 'الأردن|اردن',
    'ألمانيا|المانيا', 'إسبانيا|اسبانيا', 'السويد|سويد', 'القدس|القدس الشريف',
    'القاهرة|قاهره', 'عمّان|عمان', 'مالمو|مالموا|Malmö|Malmo',
    'غوتنبرغ|يوتيبوري|Gothenburg|Göteborg', 'ستوكهولم|ستكهولم|Stockholm',
    'جوجل|غوغل|Google', 'سامسونج|سامسونغ|Samsung', 'آبل|ابل|Apple',
    'إنستغرام|انستغرام|انستجرام|انستا|Instagram', 'واتساب|واتس|واتس اب|Whatsapp',
    'يوتيوب|يوتوب|Youtube', 'تيك توك|تيكتوك|TikTok',
    'فيسبوك|فيس بوك|فيس|Facebook', 'تلغرام|تليجرام|تيليغرام|تلجرام|Telegram',
    'سناب شات|سناب|Snapchat', 'تويتر|إكس|X', 'شات جي بي تي|تشات جي بي تي|ChatGPT',
    'بلايستيشن|بلاي ستيشن|بلاي ستيشن|PS', 'إكس بوكس|اكس بوكس|Xbox',
    'ببجي|بوبجي|PUBG', 'فورتنايت|فورت نايت|Fortnite',
    'ماينكرافت|ماين كرافت|Minecraft', 'جراند ثفت أوتو|جي تي أي|GTA',
    'فيفا|FIFA', 'ميسي|ليونيل ميسي|Messi', 'رونالدو|كريستيانو رونالدو|Cristiano Ronaldo',
    'هالاند|هولاند|Haaland', 'محمد صلاح|مو صلاح|صلاح',
    'سبايدرمان|سبايدر مان|الرجل العنكبوت', 'باتمان|بات مان|الرجل الوطواط',
    'آيرون مان|ايرون مان|الرجل الحديدي', 'إلسا|إلزا|السا|Elsa',
    'سبونج بوب|سبونجبوب|Spongebob', 'باتريك|بسيط', 'سكويدوارد|شفيق',
    'بلانكتون|شمشون', 'ميكي ماوس|ميكي|Mickey Mouse',
    'ناروتو|Naruto', 'ون بيس|One Piece', 'غوكو|جوكو|Goku',
    'رسم|تلوين|رسم وتلوين', 'تصوير|التقاط صور', 'دردشة|شات|محادثة',
    'غميضة|استغماية|استغماء', 'مظلة|شمسية|شمسيه',
    'مرمى|جول', 'صفارة|صافرة', 'واقي ساق|واقي قصبة',
    'زكام|رشح|برد', 'نظارة شمسية|نظارة شمس',
    'قلم رصاص|رصاص|قلم خشب', 'براية|مبراة', 'لاصق|شريط لاصق|تيب',
    'نقود|فلوس|مصاري|مال', 'حقيبة|شنطة|جنطة',
    'كندرة|حذاء|جزمة', 'شبشب|شحاطة|نعال', 'قميص|تي شيرت|تيشيرت',
    'بنطال|بنطلون|سروال', 'سترة|جاكيت', 'وشاح|شال',
    'نظارة|نضارة', 'حقيبة سفر|شنطة سفر|جنطة سفر',
    'كنزة|بلوزة', 'مصباح|لمبة|لمبا',
    'قمر صناعي|ساتلايت', 'جهاز أشعة|أشعة سينية|إكس راي',
    'سماعة طبية|سماعة دكتور', 'ميزان حرارة|ترمومتر',
    'سرطان البحر|سلطعون|كابوريا', 'جمبري|روبيان|قريدس',
    'دلفين|دولفين', 'كركند|لوبستر|جراد البحر',
    'بومة|بومه', 'عصفور|عصافير', 'حمامة|حمامه',
    'قط|بسة|بسه|قطة|قطة صغيرة', 'كلب|كلب صغير',
    'أسد|ليث', 'أرنب|ارنب', 'ثعلب|ثعلب بري'
  ];
  const synonymGroups = groups.map(g => g.split("|").map(a => a.trim()));
  // Index synonyms only once so game questions load quickly at server startup.
  const synonymIndex = new Map();
  for (const group of synonymGroups) {
    for (const alias of group) synonymIndex.set(norm(alias),group);
  }
  function extendAliases(aliases) {
    const result = new Set(aliases);
    for (const alias of aliases) {
      const group = synonymIndex.get(norm(alias));
      if (group) for (const member of group) result.add(member);
    }
    return [...result];
  }
  function damerau(a, b, maxAllowed) {
    // Optimal String Alignment distance; rejects distant words efficiently.
    if (Math.abs(a.length - b.length) > maxAllowed) return maxAllowed + 1;
    let prev2 = null, prev = Array.from({length: b.length + 1}, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const current = [i];
      let rowMin = i;
      for (let j = 1; j <= b.length; j++) {
        let val = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
        if (prev2 && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          val = Math.min(val, prev2[j - 2] + 1);
        }
        current.push(val);
        if (val < rowMin) rowMin = val;
      }
      prev2 = prev; prev = current;
    }
    return prev[b.length];
  }
  // Only narrowly scoped, high-confidence typos are safe to accept automatically.
  // Latin prefixes can be standalone words (Ball/Balloon, Car/Card), so never guess them.
  function errorLimit(attempt, candidate, safe) {
    const length = Math.max(attempt.length, candidate.length);
    if (!safe) {
      if (attempt.length < 3 || length > 55) return 0;
      if (length <= 4) return 1;
      if (length <= 7) return 2;
      if (length <= 12) return 3;
      return 4;
    }
    if (length > 55) return 0;
    if (/[a-z]/i.test(attempt) ? attempt.length < 6 : attempt.length < 4) return 0;
    return length <= 8 ? 1 : 2;
  }
  const keyCache = new WeakMap();
  function keysFor(question) {
    let cached = keyCache.get(question);
    if (!cached) {
      const exactOwners = new Map();
      const keysByAnswer = question.answers.map((answer,index) => {
        const keys = new Set();
        for (const alias of answer.aliases) {
          const exact=norm(alias);
          if(exact && !exactOwners.has(exact)) exactOwners.set(exact,index);
          for (const variant of variants(alias)) keys.add(variant);
        }
        return [...keys];
      });
      cached={exactOwners,keysByAnswer};
      keyCache.set(question, cached);
    }
    return cached;
  }
  function matchDetailed(question, input, options) {
    const safe=options?.safe===true;
    const attempted = norm(input);
    if (!question || !Array.isArray(question.answers) || !attempted || attempted.length > 70) return null;
    const {exactOwners,keysByAnswer}=keysFor(question);
    // The complete name must beat an article-stripped variant of a different concept.
    // For example, جبيل (Byblos) is not الجبيل (Jubail).
    const exactOwner=exactOwners.get(attempted);
    if(safe && exactOwner!==undefined) return {
      answer:question.answers[exactOwner],
      kind:norm(question.answers[exactOwner].display)===attempted?'exact':'synonym'
    };
    // Only after strict alias lookup, try orthographic variants and cautious typos.
    for (let i = 0; i < keysByAnswer.length; i++) {
      if (keysByAnswer[i].includes(attempted)) return {
        answer: question.answers[i], kind: norm(question.answers[i].display) === attempted ? 'exact' : 'synonym'
      };
    }
    // Keep different place names distinct even when edit distance is small.
    if (attempted === 'oman' || attempted === 'amman') return null;
    const proposals = [];
    for (let i = 0; i < keysByAnswer.length; i++) {
      let best = -Infinity, bestKind = null;
      for (const key of keysByAnswer[i]) {
        if ((!safe && attempted.length >= 2 && attempted.length < key.length
          && key.startsWith(attempted)
          && (attempted.length >= 3 ? attempted.length / key.length >= 0.34 : attempted.length / key.length >= 0.6))
          || (safe && /^[\u0600-\u06ff\s]+$/.test(attempted)
          && attempted.length >= 5 && attempted.length < key.length
          && attempted.length / key.length >= 0.75 && key.startsWith(attempted))) {
          // Retain narrowly scoped Arabic name completion, not arbitrary short fragments.
          const score = 110 + attempted.length / key.length * 30;
          if (score > best) { best = score; bestKind = 'partial'; }
        }
        const limit = errorLimit(attempted, key, safe);
        if (!limit || Math.abs(key.length - attempted.length) > limit) continue;
        const dist = damerau(attempted, key, limit);
        if (dist > limit) continue;
        const similarity = 1 - dist / Math.max(key.length, attempted.length);
        if (similarity < (safe?0.75:0.55)) continue;
        // Closer match beats popularity. Ties favor earlier (more familiar) answers.
        const score = 80 + similarity * 30 - dist * 1.5;
        if (score > best) { best = score; bestKind = 'typo'; }
      }
      if (bestKind) proposals.push({ answer: question.answers[i], kind: bestKind, score: best, order: i });
    }
    if (!proposals.length) return null;
    proposals.sort((a,b) => b.score - a.score || a.order - b.order);
    if (safe && proposals.length > 1 && proposals[0].score - proposals[1].score < 3) return null;
    return { answer: proposals[0].answer, kind: proposals[0].kind };
  }
  function lookup(question, input) { return matchDetailed(question, input)?.answer ?? null; }
  return { norm, extendAliases, matchDetailed, lookup };
});
