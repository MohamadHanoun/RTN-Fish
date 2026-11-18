'use strict';

// Offline Arabic ↔ English aliases. They are attached to the existing canonical
// answers, so a translation shares the same points and cannot be used twice.
// Format: Arabic names separated by |, then =>, then accepted English names.
const { norm } = require('./matcher');
const extraRows = require('./english-extra');
const rows = [
  // Animals, birds, sea life and insects.
  'كلب|كلب حراسة=>dog|dogs|guard dog',
  'قط|قطة|بسة=>cat|cats|kitty',
  'أرنب=>rabbit|bunny', 'حصان=>horse', 'حمار=>donkey', 'بقرة=>cow',
  'ثور=>bull', 'خروف|نعجة=>sheep', 'ماعز=>goat', 'جمل=>camel',
  'أسد=>lion', 'نمر=>tiger', 'فهد=>cheetah|leopard', 'فيل=>elephant',
  'زرافة=>giraffe', 'قرد=>monkey', 'غوريلا=>gorilla', 'دب=>bear',
  'دب قطبي=>polar bear', 'باندا=>panda', 'ذئب=>wolf', 'ثعلب=>fox',
  'ضبع=>hyena', 'غزال=>gazelle|deer', 'حمار وحشي=>zebra',
  'وحيد القرن=>rhino|rhinoceros', 'فرس النهر=>hippo|hippopotamus',
  'كنغر=>kangaroo', 'كوالا=>koala', 'قنفذ=>hedgehog', 'سنجاب=>squirrel',
  'فأر=>mouse', 'فأر أليف=>pet mouse', 'هامستر=>hamster',
  'خفاش=>bat', 'تمساح=>crocodile', 'ثعبان=>snake', 'سحلية=>lizard',
  'سلحفاة=>turtle', 'سلحفاة بحرية=>sea turtle',
  'سمكة|سمك=>fish', 'سمكة زينة=>pet fish|aquarium fish',
  'قرش=>shark', 'دلفين=>dolphin', 'حوت=>whale', 'أخطبوط=>octopus',
  'حبار=>squid', 'قنديل البحر=>jellyfish', 'نجمة البحر=>starfish',
  'فرس البحر=>seahorse', 'جمبري|روبيان=>shrimp|prawn',
  'سرطان البحر|سلطعون=>crab', 'كركند=>lobster', 'محار=>oyster|clam',
  'سمك التونة|تونة=>tuna', 'سمك السلمون|سلمون=>salmon',
  'سردين=>sardine', 'بلطي=>tilapia', 'حصان البحر=>seahorse',
  'عصفور=>sparrow|bird', 'طائر=>bird', 'حمامة=>pigeon|dove',
  'دجاجة|دجاج=>chicken', 'ديك=>rooster', 'بطة=>duck', 'بجعة=>swan',
  'إوزة=>goose', 'نسر=>eagle|vulture', 'عقاب=>eagle', 'صقر=>falcon',
  'ببغاء=>parrot', 'بومة=>owl', 'بطريق=>penguin', 'نعامة=>ostrich',
  'طاووس=>peacock', 'غراب=>crow|raven', 'نورس=>seagull',
  'هدهد=>hoopoe', 'كناري=>canary', 'بلبل=>nightingale',
  'فلامنغو=>flamingo', 'لقلق=>stork', 'ديك رومي=>turkey',
  'نملة=>ant', 'نحلة=>bee', 'فراشة=>butterfly', 'ذبابة=>fly',
  'بعوضة=>mosquito', 'صرصور=>cockroach', 'خنفساء=>beetle',
  'جرادة=>grasshopper|locust', 'يعسوب=>dragonfly',
  'دعسوقة=>ladybug|ladybird', 'دبور=>wasp', 'برغوث=>flea',
  'قمل=>lice|louse', 'عنكبوت=>spider',

  // Fruit, vegetables, food and drinks.
  'تفاح=>apple', 'موز=>banana', 'برتقال=>orange', 'فراولة=>strawberry',
  'عنب=>grape|grapes', 'بطيخ=>watermelon', 'شمام=>melon|cantaloupe',
  'مانجو=>mango', 'أناناس=>pineapple', 'كيوي=>kiwi', 'رمان=>pomegranate',
  'خوخ=>peach', 'مشمش=>apricot', 'كرز=>cherry|cherries',
  'تين=>fig', 'تمر=>date|dates', 'جوافة=>guava', 'بابايا=>papaya',
  'أفوكادو=>avocado', 'توت=>berries|berry', 'توت أزرق=>blueberry',
  'ليمون=>lemon', 'ليمون أخضر=>lime', 'يوسفي=>tangerine|mandarin',
  'كمثرى|إجاص=>pear', 'برقوق=>plum', 'جريب فروت=>grapefruit',
  'بطاطا|بطاطس=>potato', 'بطاطا حلوة=>sweet potato',
  'طماطم|بندورة=>tomato', 'خيار=>cucumber', 'جزر=>carrot',
  'بصل=>onion', 'ثوم=>garlic', 'خس=>lettuce', 'ملفوف=>cabbage',
  'فلفل=>pepper', 'فلفل أحمر=>red pepper', 'فلفل أخضر=>green pepper',
  'باذنجان=>eggplant|aubergine', 'كوسا=>zucchini|courgette',
  'سبانخ=>spinach', 'قرنبيط|زهرة=>cauliflower', 'بروكلي=>broccoli',
  'فجل=>radish', 'لفت=>turnip', 'شمندر|بنجر=>beetroot|beet',
  'فاصولياء=>beans|green beans', 'بازلاء=>peas', 'بامية=>okra',
  'كرفس=>celery', 'كراث=>leek', 'هليون=>asparagus',
  'خرشوف=>artichoke', 'فطر|مشروم=>mushroom', 'ذرة=>corn',
  'خبز=>bread', 'رز|أرز=>rice', 'حليب=>milk', 'بيض=>eggs|egg',
  'جبن=>cheese', 'لحم=>meat', 'دجاج=>chicken', 'سمك=>fish',
  'سكر=>sugar', 'ملح=>salt', 'عسل=>honey', 'زيت=>oil',
  'قهوة=>coffee', 'شاي=>tea', 'ماء=>water', 'عصير=>juice',
  'عصير برتقال=>orange juice', 'عصير تفاح=>apple juice',
  'عصير رمان=>pomegranate juice', 'ليمونادة=>lemonade',
  'شاي أخضر=>green tea', 'آيس كريم|بوظة=>ice cream',
  'كيك=>cake', 'شوكولاتة=>chocolate', 'بسكويت=>biscuit|cookie',
  'دونات=>donut|doughnut', 'كنافة=>kunafa|knafeh',
  'بقلاوة=>baklava', 'معمول=>maamoul', 'بسبوسة=>basbousa',
  'فلافل=>falafel', 'حمص=>hummus', 'شاورما=>shawarma',
  'تبولة=>tabbouleh|tabouli', 'فتوش=>fattoush',
  'كبسة=>kabsa', 'مندي=>mandi', 'مقلوبة=>maqluba',
  'منسف=>mansaf', 'كبة=>kibbeh|kibbe', 'كشري=>koshari',
  'بيتزا=>pizza', 'برغر=>burger|hamburger', 'سوشي=>sushi',
  'رامن=>ramen', 'تاكو=>taco', 'باستا=>pasta', 'نودلز=>noodles',

  // Colors, shapes, nature and the human body.
  'أحمر=>red', 'أزرق=>blue', 'أخضر=>green', 'أصفر=>yellow',
  'أسود=>black', 'أبيض=>white', 'رمادي=>gray|grey',
  'برتقالي=>orange', 'بنفسجي=>purple|violet', 'وردي|زهري=>pink',
  'بني=>brown', 'ذهبي=>gold|golden', 'فضي=>silver',
  'كحلي=>navy blue', 'سماوي=>sky blue', 'بيج=>beige',
  'تركوازي=>turquoise', 'قلب=>heart', 'عين=>eye', 'أذن=>ear',
  'أنف=>nose', 'فم=>mouth', 'لسان=>tongue', 'يد=>hand',
  'قدم=>foot', 'رأس=>head', 'دماغ=>brain', 'معدة=>stomach',
  'رئة=>lung', 'كبد=>liver', 'كلية=>kidney', 'جلد=>skin',
  'عظم=>bone', 'أسنان=>teeth', 'عضلة=>muscle',
  'شمس=>sun', 'قمر=>moon', 'نجمة|نجم=>star', 'سحاب|غيمة=>cloud',
  'مطر=>rain', 'ثلج=>snow|ice', 'نار=>fire', 'هواء=>air',
  'برق=>lightning', 'رعد=>thunder', 'بحر=>sea', 'محيط=>ocean',
  'نهر=>river', 'بحيرة=>lake', 'جبل=>mountain', 'صحراء=>desert',
  'شاطئ=>beach', 'غابة=>forest', 'جزيرة=>island',
  'وردة|ورد=>rose', 'ياسمين=>jasmine', 'نعناع=>mint',
  'شجرة=>tree', 'نخلة=>palm tree', 'زيتون=>olive',

  // Buildings, everyday objects, clothes and technology.
  'بيت|منزل=>house|home', 'مدرسة=>school', 'جامعة=>university',
  'مستشفى=>hospital', 'مكتبة=>library', 'مطار=>airport',
  'مطعم=>restaurant', 'سوق=>market', 'مسجد=>mosque',
  'حديقة=>park|garden', 'ملعب=>stadium|playground',
  'متحف=>museum', 'فندق=>hotel', 'شارع=>street',
  'باب=>door', 'نافذة=>window', 'كرسي=>chair', 'طاولة=>table',
  'سرير=>bed', 'مخدة|وسادة=>pillow', 'بطانية=>blanket',
  'مرآة=>mirror', 'مصباح=>lamp|light', 'ثلاجة=>fridge|refrigerator',
  'فرن=>oven', 'موقد=>stove', 'ميكروويف=>microwave',
  'مقلاة=>frying pan|pan', 'ملعقة=>spoon', 'شوكة=>fork',
  'سكين=>knife', 'كوب|كاسة=>cup|glass', 'صحن|طبق=>plate',
  'قدر=>pot', 'غسالة=>washing machine', 'مكيف=>air conditioner|ac',
  'تلفزيون=>television|tv', 'هاتف|موبايل=>phone|mobile phone|cell phone',
  'حاسوب|كمبيوتر=>computer|pc', 'لابتوب=>laptop',
  'لوحة مفاتيح|كيبورد=>keyboard', 'ماوس|فأرة=>mouse',
  'سماعات=>headphones|earphones', 'ميكروفون=>microphone|mic',
  'طابعة=>printer', 'كاميرا=>camera', 'ساعة=>clock|watch',
  'كتاب=>book', 'دفتر=>notebook', 'قلم=>pen', 'قلم رصاص=>pencil',
  'مسطرة=>ruler', 'ممحاة=>eraser', 'حقيبة|شنطة=>bag',
  'حقيبة سفر=>suitcase', 'مفتاح=>key', 'شاحن=>charger',
  'قميص=>shirt', 'بنطال=>pants|trousers', 'فستان=>dress',
  'حذاء=>shoe|shoes', 'جوارب=>socks', 'معطف=>coat',
  'سترة=>jacket', 'قبعة=>hat', 'وشاح=>scarf',
  'قفازات=>gloves', 'حزام=>belt', 'نظارة=>glasses',
  'نظارة شمسية=>sunglasses', 'عباءة=>abaya', 'ثوب=>thobe',
  'سيارة=>car', 'حافلة|باص=>bus', 'دراجة=>bicycle|bike',
  'قطار=>train', 'طائرة=>airplane|plane', 'سفينة=>ship',
  'قارب=>boat', 'دراجة نارية=>motorcycle', 'تاكسي=>taxi',
  'شاحنة=>truck', 'مروحية=>helicopter', 'مترو=>metro|subway',
  'سكوتر=>scooter', 'غواصة=>submarine',
  'طبيب=>doctor', 'ممرض=>nurse', 'معلم=>teacher',
  'مهندس=>engineer', 'محامي=>lawyer', 'طيار=>pilot',
  'سائق=>driver', 'طباخ=>chef|cook', 'مزارع=>farmer',
  'شرطي=>police officer', 'مبرمج=>programmer|developer',
  'كرة القدم=>football|soccer', 'كرة السلة=>basketball',
  'السباحة|سباحة=>swimming', 'الجري=>running', 'التنس=>tennis',
  'الملاكمة=>boxing', 'الشطرنج|شطرنج=>chess',

  // Arab countries and some frequent place names.
  'السعودية|المملكة العربية السعودية=>saudi arabia|ksa',
  'مصر=>egypt', 'سوريا|سورية=>syria', 'العراق=>iraq',
  'الأردن=>jordan', 'لبنان=>lebanon', 'فلسطين=>palestine',
  'الإمارات|الإمارات العربية المتحدة=>united arab emirates|uae',
  'الكويت=>kuwait', 'قطر=>qatar', 'البحرين=>bahrain',
  'اليمن=>yemen', 'المغرب=>morocco', 'الجزائر=>algeria',
  'تونس=>tunisia', 'ليبيا=>libya', 'السودان=>sudan',
  'موريتانيا=>mauritania', 'الصومال=>somalia',
  'جيبوتي=>djibouti', 'جزر القمر=>comoros',
  'الرياض=>riyadh', 'القاهرة=>cairo', 'دمشق=>damascus',
  'بغداد=>baghdad', 'بيروت=>beirut', 'القدس=>jerusalem|al quds',
  'مكة=>mecca|makkah', 'المدينة المنورة=>medina|madinah',
  'جدة=>jeddah|jiddah', 'دبي=>dubai', 'أبوظبي=>abu dhabi',
  'الدوحة=>doha', 'المنامة=>manama', 'مسقط=>muscat',
  'صنعاء=>sanaa|sana a', 'الرباط=>rabat',
  'الجزائر العاصمة=>algiers', 'الخرطوم=>khartoum',
  'طرابلس=>tripoli', 'نواكشوط=>nouakchott',
  'مقديشو=>mogadishu', 'موروني=>moroni',
  'الإسكندرية=>alexandria', 'حلب=>aleppo', 'حمص=>homs',
  'حماة=>hama', 'البصرة=>basra', 'الموصل=>mosul',
  'أربيل=>erbil', 'إربد=>irbid', 'الزرقاء=>zarqa',
  'غزة=>gaza', 'نابلس=>nablus', 'الخليل=>hebron',
  'رام الله=>ramallah', 'يافا=>jaffa', 'حيفا=>haifa',
  'مراكش=>marrakech', 'فاس=>fez|fes',
  'الدار البيضاء=>casablanca', 'وهران=>oran',
  'قسنطينة=>constantine', 'صفاقس=>sfax',
  'سوسة=>sousse', 'بنغازي=>benghazi',
  'بورتسودان=>port sudan', 'عدن=>aden',
  'صلالة=>salalah', 'نزوى=>nizwa', 'الشارقة=>sharjah',
  'العين=>al ain', 'عجمان=>ajman',
  'المسجد الحرام=>grand mosque of mecca|masjid al haram',
  'الكعبة=>kaaba|ka bah', 'المسجد النبوي=>prophets mosque|masjid an nabawi',
  'الأهرامات|أهرامات الجيزة=>pyramids|pyramids of giza',
  'أبو الهول=>sphinx', 'برج خليفة=>burj khalifa',
  'البتراء=>petra', 'المسجد الأقصى=>al aqsa|al aqsa mosque',
  'قبة الصخرة=>dome of the rock', 'الجامع الأموي=>umayyad mosque',
  'قلعة حلب=>aleppo citadel', 'قلعة أربيل=>erbil citadel',
  'سوق واقف=>souq waqif', 'قلعة البحرين=>bahrain fort',
  'جامع الشيخ زايد=>sheikh zayed grand mosque',
  'مغارة جعيتا=>jeita grotto', 'جبل كارتالا=>mount kartala',
  'بحيرة عسل=>lake assal', 'بحيرة آبي=>lake abbe',
  'قصبة آيت بن حدو|آيت بن حدو=>ait benhaddou',
  'برج إيفل=>eiffel tower', 'سور الصين العظيم=>great wall of china',
  'تمثال الحرية=>statue of liberty', 'تاج محل=>taj mahal',
  ...extraRows,
];

const dictionary = new Map();
for (const row of rows) {
  const [arabic, english] = row.split('=>');
  const translations = english.split('|');
  for (const name of arabic.split('|')) {
    const key = norm(name);
    dictionary.set(key, [...new Set([...(dictionary.get(key) || []), ...translations])]);
  }
}

// Reuse explicit English spellings from *every* category. For example, the
// English name of a game, country or city is accepted in other questions too.
function registerSharedAliases(sourceQuestions) {
  for(const [, serialized] of sourceQuestions) {
    for(const entry of serialized.split(',')) {
      const names=entry.split('|').map(x=>x.trim()).filter(Boolean);
      const english=names.filter(x=>/[a-z]/i.test(x) && !/[\u0600-\u06ff]/.test(x));
      if(!english.length)continue;
      for(const arabic of names.filter(x=>/[\u0600-\u06ff]/.test(x))) {
        const key=norm(arabic);
        if(key==='عمان')continue; // city Amman and country Oman are distinct
        dictionary.set(key,[...new Set([...(dictionary.get(key)||[]),...english])]);
      }
    }
  }
}

// Searchable fallback for names typed phonetically in Latin letters.
// Explicit dictionary translations always remain the primary English aliases.
const romanLetters = Object.freeze({
  'ا':'a','أ':'a','إ':'i','آ':'a','ب':'b','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh',
  'د':'d','ذ':'dh','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t',
  'ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n',
  'ه':'h','ة':'a','و':'w','ؤ':'w','ي':'y','ى':'a','ئ':'y','ء':''
});
function romanize(value) {
  return [...String(value).replace(/[\u064B-\u065F\u0640]/g,'')]
    .map(character=>romanLetters[character] ?? character).join('')
    .replace(/[^a-z0-9\s]/gi,'').replace(/\s+/g,' ').trim().toLowerCase();
}

function englishAliases(aliases, prompt) {
  const all = new Set(aliases);
  for (const alias of aliases) {
    const key = norm(alias);
    for (const translation of dictionary.get(key) || []) all.add(translation);
    if(/[\u0600-\u06ff]/.test(alias) && alias.length>=3) {
      const phonetic=romanize(alias);
      if(phonetic.length>=3)all.add(phonetic);
    }
    // Arabic spelling without vowel marks merges the country Oman and city Amman.
    if (key === 'عمان') {
      if (/عاصمة|مدينة|الأردن/.test(prompt)) all.add('Amman');
      else all.add('Oman');
    }
  }
  return [...all];
}

module.exports = { englishAliases, registerSharedAliases };
