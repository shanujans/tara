'use client';
import { useEffect, useState } from 'react';
import { XIcon, PackageIcon, RewardsIcon, BrowseIcon, SettingsIcon, HelpIcon, ChevronRightIcon, TrashIcon, PackageSearchIcon } from './Icons';
import { Lang, STRINGS } from '@/lib/strings';

export type PanelId = 'none' | 'history' | 'rewards' | 'browse' | 'settings' | 'help' | 'notifications' | 'menu' | 'track' | 'manual';

interface SidePanelProps {
  panel: PanelId;
  lang: Lang;
  onClose: () => void;
  onCategorySearch: (query: string) => void;
  onLangChange: (l: Lang) => void;
  onClearChat: () => void;
  onNavigate: (panel: Exclude<PanelId, 'none' | 'menu'>) => void;
  speakerOn: boolean;
  onSpeakerToggle: () => void;
}

const FALLBACK_CATEGORIES = [
  { id:'flowers',   emoji: '💐', name: 'Flowers',         query: 'Show me flowers and bouquets on Kapruka'       },
  { id:'cakes',     emoji: '🎂', name: 'Cakes',            query: 'Show me birthday cakes on Kapruka'              },
  { id:'gifts',     emoji: '🎁', name: 'Gift Hampers',     query: 'Show me gift hampers on Kapruka'                },
  { id:'elec',      emoji: '📱', name: 'Electronics',      query: 'Show me electronics on Kapruka'                 },
  { id:'fashion',   emoji: '👗', name: 'Fashion',          query: 'Show me fashion and clothing on Kapruka'        },
  { id:'grocery',   emoji: '🛒', name: 'Groceries',        query: 'Show me groceries on Kapruka'                   },
  { id:'books',     emoji: '📚', name: 'Books',            query: 'Show me books on Kapruka'                       },
  { id:'toys',      emoji: '🎮', name: 'Toys & Games',     query: 'Show me toys and games on Kapruka'             },
  { id:'jewelry',   emoji: '💍', name: 'Jewelry',          query: 'Show me jewelry on Kapruka'                    },
  { id:'choc',      emoji: '🍫', name: 'Chocolates',       query: 'Show me chocolates and sweets on Kapruka'      },
  { id:'health',    emoji: '🌿', name: 'Health & Beauty',  query: 'Show me health and beauty products on Kapruka' },
  { id:'home',      emoji: '🏠', name: 'Home & Living',    query: 'Show me home and decor on Kapruka'             },
];

const FAQS = [
  { q: 'How do I place an order?', a: 'Just tell TARA what you want — she\'ll find it, let you add to cart, and guide you to payment.' },
  { q: 'What languages does TARA support?', a: 'Sinhala (සිං), Sihalish (SL), Tamil (த), Tanglish (TL) and English (EN). Switch with the language pills.' },
  { q: 'How does payment work?', a: 'After checkout, TARA hands off to Kapruka\'s secure payment page. Your card details never touch our servers.' },
  { q: 'Can I order from abroad?', a: 'Yes! Tell TARA "I\'m ordering from abroad" and she\'ll switch to Expat mode — perfect for the diaspora.' },
  { q: 'How fast is delivery?', a: 'Express (next-day) and Standard available. TARA will check delivery dates for your city.' },
  { q: 'How do I track my order?', a: 'Just paste your order ID in the chat — e.g. "Track KAP123456".' },
];

/* ════════════════════════════════════════════════════════════════════════════
   USER MANUAL PANEL — Complete guide with 5-language examples
   ═══════════════════════════════════════════════════════════════════════════ */
function UserManualPanel({ lang }: { lang: Lang }) {
  const strings = STRINGS[lang] ?? STRINGS.en;

  // Section data
  const sections = [
    {
      id: 'text-chat',
      title: { en: 'Text Chat', si: 'පාඨ කතාබහ', sl: 'Text Chat', ta: 'உரை அரட்டை', tl: 'Text Chat' },
      icon: '💬',
      items: [
        { 
          title: { en: 'Type naturally', si: 'සාමාන්‍යව ලියන්න', sl: 'Samanawai liyanna', ta: 'இயல்பாகத் தட்டச்சு செய்க', tl: 'Iyalpaga thattachu seiga' },
          desc: { 
            en: 'Just type what you need. TARA understands context, occasion, and delivery details in one message.',
            si: 'ඔබට අවශ්‍ය දෙය හමුවේ ලියන්න. TARA සහතික, සුළු සිරුර සහ ලබාදීමේ විස්තර එකතු කිරීමට පුළුවන්.',
            sl: 'Owata awashya deyata hamuwe liyanna. TARA sahakthika, sulu sirura saha labadima visthara ekathu karanata puluwan.',
            ta: 'உங்களுக்கு தேவையானதை வெறும் இனிமatiesப்படச் செய்யவும். TARA சூழல், விழா மற்றும் விநியோக விவரங்களை ஒரு செய்தியில் புரிந்துகொள்ளும்.',
            tl: 'Ungalukku thevaiyanaidhai verum inimatip padach seigavum. TARA soozhal, vizhaa matrum viniyoga vivarangalai oru seidhiyil purinthukolum.'
          },
          examples: [
            { lang: 'en', text: 'I want to send a birthday cake to my sister in Colombo 7 tomorrow' },
            { lang: 'si', text: 'මම හෙට කොළඹ 7ට මගේ අක්කට උපන්දින කේක් එකක් යවනවා' },
            { lang: 'sl', text: 'Mama heta Colombo 7ta mage akkata upan dinakak eta' },
            { lang: 'ta', text: 'நான் நாளை கொழும்பு 7ல் என் அக்காவுக்கு பிறந்தநாள் கேக் அனுப்ப விரும்புகிறேன்' },
            { lang: 'tl', text: 'Naan naalai Kozhumbu 7la en akkavukku pirandhanaal cake anuppa virumbugiren' },
          ]
        },
        {
          title: { en: 'Combined search + checkout in one message', si: 'එක් පණිවුඩයෙන් සොයීම හා චෙක්අවුට්', sl: 'Eka pinividayen soyiya ha check-out', ta: 'ஒரு செய்தியில் தேடல் + செக்அவுட்', tl: 'Oru seidhiyil thaedal + checkout' },
          desc: { 
            en: 'Provide product + full delivery details together. TARA emits <search_query> then <checkout_fill> and opens the cart.',
            si: 'භාණ්ඩය + පූර්ණ ලබාදීමේ විස්තර එක්ව දෙන්න. TARA <search_query> පසු <checkout_fill> නිකුත් කර කාට් විවෘත කරයි.',
            sl: 'Bhandaya + poorna labadima vistara ekwe dennna. TARA <search_query> pasu <checkout_fill> nikuth kara kathuwa vivruth karayi.',
            ta: 'தொழில் + முழு விநியோக விவரங்களையும் சேர்த்து கொடுக்கவும். TARA <search_query> பிறகு <checkout_fill> வெளியிடுகின்றது மற்றும் கார்ட் திறக்கிறது.',
            tl: 'Thozhil + muzh u viniyoga vivarangalaium serthu kodukkavum. TARA <search_query> piragu <checkout_fill> veliyaidukirathu matrum card thirakkirathu.'
          },
          examples: [
            { lang: 'en', text: 'Send iPhone 16 Pro to Priya, 23 Galle Road Colombo 3, 0771234567, tomorrow, House, shanu@gmail.com' },
            { lang: 'si', text: 'ප්‍රියාවට 23 ගාල්ල මාර්ග කොළඹ 3, 0771234567, හෙට, නිවාස, shanu@gmail.com ලිපිනයට iPhone 16 Pro යවන්න' },
            { lang: 'sl', text: 'Priyawata 23 Galle Road Colombo 3, 0771234567, heta, niwasa, shanu@gmail.com lipiyata iPhone 16 Pro yavanna' },
            { lang: 'ta', text: 'பிரியாவிற்கு 23 காலி சாலை கொழும்பு 3, 0771234567, நாளை, வீடு, shanu@gmail.com க்கு iPhone 16 Pro அனுப்பு' },
            { lang: 'tl', text: 'Priyavirkku 23 Kaali Salai Kozhumbu 3, 0771234567, naalai, veedu, shanu@gmail.com ku iPhone 16 Pro anuppu' },
          ]
        },
        {
          title: { en: 'Complex example (your Tamil sample)', si: 'සංකීර්ණ උදාහරණය (ඔබේ දෙමළ උදාහරණය)', sl: 'Sankirana udaharanaya (Owge Tamil udaharanaya)', ta: 'சிக்கலான உதாரணம் (உங்கள் தமிழ் மாதிரி)', tl: 'Sikkalana udharanam (Ungal Tamil maathiri)' },
          desc: { 
            en: 'Full gift message + delivery instructions + occasion in one sentence.',
            si: 'සම්පූර්ණ උපහාර පණිවුඩය + ලබාදීමේ නිර්දේශ + සුළු සිරුර එක් වාක්යයකින්.',
            sl: 'Sampurna upahara pinividaya + labadima nirdeshaya + sulu sirura eka vakyakayakin.',
            ta: 'முழு காதல் செய்தி + விநியோக அறிவிப்புகள் + விழா எல்லாம் ஒரு வாக்கியத்தில்.',
            tl: 'Muzhu kadhal seidhi + viniyoga arivipugalum vizha ellam oru vaakkiyathil.'
          },
          examples: [
            { lang: 'en', text: 'Send iPhone 16 Pro worth Rs. 485,000 from Suresh to Karthik in Batticaloa (0771234567, karthik@email.com, No. 12, Arasadi Veethi) for delivery on 2026-07-18 with gift message "Celebrate life"' },
            { lang: 'si', text: 'සුරේශ් විසින් මඩකලපුවට පැමිණි කාර්තික්ට 0771234567, karthik@email.com, 12 වෙනි අරසාදි වීදිහි 2026-07-18 දින රු. 485,000 අගයන් iPhone 16 Pro එක වෙන්නේ "ජීවිතය සමරන්න" යන උපහාර පණිවුඩයෙන්' },
            { lang: 'sl', text: 'Suresh wisin Madakalapuwata penimu Karthikta 0771234567, karthik@email.com, 12 weni Arasadi Veediya 2026-07-18 din Rs. 485,000 agayen iPhone 16 Pro ek venne "Jivithaya samaranna" yana upahara pinividayen' },
            { lang: 'ta', text: 'சுரேஷ் என்பவரால் மட்டக்களப்பைச் சேர்ந்த கார்த்திக்கிற்கு (0771234567, karthik@email.com, இலக்கம் 12, அரசடி வீதி) 2026 ஜூலை 18 அன்று வழங்கப்பட்ட ரூபா 485,000 பெறுமதியான iPhone 16 Pro இற்கான வாழ்த்துச் செய்தி, "வாழ்க்கையை கொண்டாடுங்கள்" என்ற குறிப்புடன் அனுப்பப்படும்.' },
            { lang: 'tl', text: 'Suresh enpavaral Mattakkalappaich cherndha Karthikkirku (0771234567, karthik@email.com, ilakkam 12, Arasadi Veethi) 2026 July 18 andru vangaipatta Rubai 485,000 perumathiyaana iPhone 16 Pro irukka vazhthu seidhi, "Vaazhkaiyai kondadungal" endra kurippudan anuppappadum.' },
          ]
        },
      ]
    },
    {
      id: 'voice',
      title: { en: 'Voice Mode (Two Options)', si: 'ද්විත්ව විකල්ප (දෙකක්)', sl: 'Dwithwa vikalpa (Dekak)', ta: 'உரை பயன்முறை (இரண்டு விருப்பங்கள்)', tl: 'Urai payanmurai (Irandu viruppangal)' },
      icon: '🎙️',
      items: [
        {
          title: { en: '1️⃣ Legacy STT + TTS (Push-to-talk)', si: '1️⃣ පැරණි STT + TTS (බලාපොරොත්තු කතාව)', sl: '1️⃣ Pragani STT + TTS (Balaporoththu kathava)', ta: '1️⃣ பழைய STT + TTS (மீன்விட்டு பேசு)', tl: '1️⃣ Pazhaya STT + TTS (Meenvittu pesu)' },
          desc: { 
            en: 'Tap the 🎤 mic button → speak → tap again to cancel OR tap the green Send button to submit. Hands-free toggle (✨ sparkle) auto-restarts after TARA speaks.',
            si: '🎤 මයික් බොත්තම මගින් තොරතුරු ලබා දෙන්න → බොලෙන්න → අවලංගු කිරීමට නැවත මගින් මගින් යාමේ හෝ ලස්සන යවන බොත්තම මගින් යවන්න. මුළු ප්‍රමාණයෙන් (✨ ප්‍රභාව) TARA කතා කළ පසු ස්වයංක්‍රීයව ආරම්භ කරයි.',
            sl: '🎤 mic button mageenin thorathuru labba danna → bolennna → awulang karanata nawa maga mageenin yama ha lassa yavanna button mageenin yavanna. Mul pramanayen (✨ prabhava) TARA kata kala pasu swayankriyawa arambha karayi.',
            ta: '🎤 மைக் பொத்தானை அழுத்து → பேசு → மறுதமாக அழுத்தி ரத்து செய் அல்லது பச்சை அனுப்பு பொத்தானை அழுத்து. கൈப்பிடி இல்லாமல் mood (✨ மின்னல்) TARA பேசிய பிறகு தானாக துவங்குகிறது.',
            tl: '🎤 mic pothanai azhuthu → pesu → maruthamaga azhuthi ratthu seiyya allathu pachchai anuppu pothanai azhuthu. Kaippidi illamal mood (✨ minnal) TARA pesiya piragu thaanaga thuvangukirathu.'
          },
          examples: [
            { lang: 'en', text: '"Show me birthday cakes under 5000 rupees"' },
            { lang: 'si', text: '"මට 5000 රුපියල් අඩු උපන්දින කේක් පෙන්වන්න"'},
            { lang: 'sl', text: '"Mata 5000 rupiyal adi upan dinak cake penvanna"'},
            { lang: 'ta', text: '"எனக்கு 5000 ரூபாய் கீழே பிறந்தநாள் கேக்குகள் காட்டு"'},
            { lang: 'tl', text: '"Enakku 5000 rupaay kizhe pirandhanaal caekugal kaattu"'},
          ]
        },
        {
          title: { en: '2️⃣ Gemini Live Voice (Real-time, hands-free)', si: '2️⃣ Gemini Live පාවාදේශීය (සාවාදීය, මුළු ප්‍රමාණයෙන්)', sl: '2️⃣ Gemini Live pawadeshiya (Savadhiya, Mul pramanayen)', ta: '2️⃣ Gemini Live குரல் (நேரடி, கையில்லாமல்)', tl: '2️⃣ Gemini Live kural (Neradi, kaiyillamal)' },
          desc: { 
            en: 'Click the ✨ sparkle button in chat header. One persistent WebSocket — no push-to-talk needed. Speak naturally; TARA replies instantly with voice. Mic auto-pauses during TTS, resumes after. Two-gate latch ensures instant confirmation plays first, then main response, then upsell.',
            si: 'කතා හැඩේ ✨ ප්‍රභාව බොත්තම ක්ලික් කරන්න. එක් ස්ථාවර WebSocket — push-to-talk අවශ්‍ය නැහැ. සාමාන්‍යව කතා කරන්න; TARA කාලීන ආවේගයෙන් ප්‍රතිචාර දෙයි. TTS දී මයික් ස්වයංක්‍රීයව විරාම වෙයි, පසුව ආරම්භ වෙයි. දෙක් දැක්වීම තහවුරු කිරීම ස්වයංක්‍රීයව පළමුව සන්නිවේදනය, පසුව ප්‍රධාන ප්‍රතිචාර, අවසානයේ උපසෙල් ප්‍රතිචාර පැවතීමට උදව් කරයි.',
            sl: 'Katha hadae ✨ prabhava button click karanna. Eka sthawara WebSocket — push-to-talk awashya naae. Samanawai kata karanna; TARA kalina awegen prathichara deyayi. TTS di mic swayankriyawa viraya wemi, pasu aramba wemi. Deka dakweema thahuwa karanwa swayankriyawa prathama sannivedanaya, pasu pradhana prathichara, awasane upasela prathichara pravesha karanata udaw karayi.',
            ta: 'அரட்டை தலையில் ✨ மின்னல் பொத்தானைக் கிளிக் செய்யவும். ஒரே தொடர்ச்சியான WebSocket — push-to-talk தேவை இல்லை. இயல்பாக பேசுங்கள்; TARA உடனடி குரலովா பதிலளிக்கும். TTS நேரத்தில் மைக் தானாக இடைநிறுத்தம், பிறகு தொடர்ந்து. இருநிலை ஸ்விட்ச் உடனடி உறுதிப்படுத்தல் முதலில் பேட்ர retenir, பின்னர் முக்கிய பதில், முடிவில் உப்பூசல்.',
            tl: 'Aratta thalaiail ✨ minnal pothanai click seiyavum. Orey thodarchiyana WebSocket — push-to-talk thevai illai. Iyalpaga pesungal; TARA udanadi kuralova pathilalikkum. TTS nerathil mic thaanaga idainirutham, piragu thodarum. Irunilai switch udanadi uruthippaduthal muthal uruthi, pinnar mukkiya pathil, mudivil uppusal.'
          },
          examples: [
            { lang: 'en', text: '"I need a gift for my mom — maybe flowers or chocolates, deliver to Kandy by Friday"' },
            { lang: 'si', text: '"මට මාමට උපහාරයක් අවශ්‍යයි — මල් හෝ චොක්ලට් වෙන්න, ශුක්‍රවාරයේ දිනේ මහනුවරට ලබා දෙන්න"'},
            { lang: 'sl', text: '"Mata mamata upaharayak awashyai — mal ho chocolates wenne, shukravaraye dine Mahanuwarata labba dennna"'},
            { lang: 'ta', text: '"எனக்கு அம்மா க்கு ஒரு காதல் வேண்டும் — கூடிதாக மலர்கள் அல்லது சாக்லேட்கள், வெள்ளிக்கிழமை மடித்துரையில் வழங்கவும்"'},
            { lang: 'tl', text: '"Enakku amma ku oru kadhal vendum — koodithaaga malargal allathu chocolates, vellikizhamai madithuraiyil vangaippavum"'},
          ]
        },
      ]
    },
    {
      id: 'vision',
      title: { en: 'Vision Search (Image → Product)', si: 'දෘෂ්‍ය සොයීම (රූපය → භාණ්ඩ)', sl: 'Drushya soyiya (Rupaya → Bhandaya)', ta: 'காட்சி தேடல் (படம் → தொழில்)', tl: 'Katchi thaedal (Padam → Thozhil)' },
      icon: '📸',
      items: [
        {
          title: { en: 'Upload or paste an image', si: 'රූපයක් උඩුගත කරන්නෝ පිටපත් කරන්න', sl: 'Rupayak ugath karannao pita path karanna', ta: 'படத்தை பதிவேற்று அல்லது ஒட்டு', tl: 'Padathai padiyettiru allathu otta' },
          desc: { 
            en: 'Drag-drop, paste (Ctrl+V), or click the 📷 camera icon in the chat input. TARA identifies the product via Gemini Vision, then searches Kapruka automatically.',
            si: 'ප්‍රවාහනය කරන්න, පිටපත් කරන්න (Ctrl+V), හෝ කතා ඇතුලත් කිරීමේ 📷 කැමරා අකුරු ක්ලික් කරන්න. TARA Gemini Vision මගින් භාණ්ඩය හඳුනාගනී, පසුව Kapruka ස්වයංක්‍රීයව සොයයි.',
            sl: 'Pravahana karanna, pita path karanna (Ctrl+V), ho katha athulath karanaya 📷 camera akuru click karanna. TARA Gemini Vision magein bhandaya hadunaganna, pasu Kapruka swayankriyawa soyi.',
            ta: 'வலியேற்று, ஒட்டு (Ctrl+V), அல்லது அரட்டை உள்ளீட்டில் 📷 TamilSetu ஒசதسسி கிளிக் செய்யவும். TARA Gemini Vision மூலம் தற்பொருள் கண்டுபிடித்து, பின்னர் Kapruka-யை தானாக தேடுகிறது.',
            tl: 'Valiyetru, ottu (Ctrl+V), allathu aratta ullaetil 📷 camera icon click seiyavum. TARA Gemini Vision moolam tharporul kandupidiuthu, pinnar Kapruka-ai thaanaga thaedukirathu.'
          },
          examples: [
            { lang: 'en', text: '(Paste a photo of a watch, perfume bottle, or dress)' },
            { lang: 'si', text: '(ඔරලෝසුවක්, සුගන්ධ බෝතලක් හෝ ඇඳුම් පින්තූරයක් පිටපත් කරන්න)' },
            { lang: 'sl', text: '(Oralosuwaak, suganda bothalak allathu adina pinthurayak pita path karanna)' },
            { lang: 'ta', text: '(ஓர் மணி, மணம் batzல், அல்லது உடை படத்தை ஒட்டவும்)' },
            { lang: 'tl', text: '(Oru mani, manam bottle, allathu udai padathai ottavum)' },
          ]
        },
      ]
    },
    {
      id: 'checkout',
      title: { en: 'Natural Language Checkout', si: 'සාමාන්‍ය භාෂා චෙක්අවුට්', sl: 'Samanaya bhasha check-out', ta: 'இயல்பு மொழி செக்அவுட்', tl: 'Iyalpu mozhi check-out' },
      icon: '🛒',
      items: [
        {
          title: { en: 'Auto-fills all fields from chat', si: 'කතාවෙන් සියලු ක්ෂේත්‍ර ස්වයංක්‍රීයව පුරවන්න', sl: 'Kathawen sithulu kshethra swayankriyawa puravanna', ta: 'அரட்டையிலிருந்து எல்லா புலங்களையும் தானாக ஒழுங்கு செய்', tl: 'Arattaiyilirundhu ella pulangalaiyum thaanaga ozhungu sei' },
          desc: { 
            en: 'When TARA detects delivery details, she emits <checkout_fill> JSON. Cart opens with all fields pre-filled: recipient name/phone/address/city/date/occasion/gift message/special instructions/sender info.',
            si: 'TARA ලබාදීමේ විස්තර හඳුනාගෙන ගැනීමෙන්ම, <checkout_fill> JSON නිෂ්පාදනය කරයි. කාට් සියලු ක්ෂේත්‍ර පුරවා විවෘත වේ: ලබාගැනීමේ නම/දුරකතන/ලිපිනය/නගරය/දිනය/සුළු සිරුර/උපහාර පණිවුඩය/විශේෂ නිර්දේශ/යවන්නාගේ විස්තර.',
            sl: 'TARA labadima vistara hadunagena gannemoth, <checkout_fill> JSON nishpadanaya karayi. Kathu sithulu kshethra purava vivruth ve: labaganimma nam/ durakathana/ lipinaya/ nagaraya/ dinaya/ sulu sirura/ upahara pinividaya/ vishesha nirdeshaya/ yavannange vistara.',
            ta: 'TARA விநியோக விவரங்களைக் கண்டுபிடித்து, <checkout_fill> JSON வெளியிடுகின்றது. கார்ட் அனைத்து புலங்களும் முன்ன உடன் விறக்கப்பட்டு திறக்கப்படும்: பெறுபவர் பெயர்/தொலைபேசி/முகவரி/நகரம்/தேதி/விழா/காதல் செய்தி/விசேஷ நிரਦੇசங்கள்/அனுப்புநர் விவரங்கள்.',
            tl: 'TARA viniyoga vivarangalai kandupidithu, <checkout_fill> JSON veliyaidukirathu. Cart ella pulangalum mun udan virakkappattu thirakkappadum: perupavar peyar/ tolaipesi/ mugavari/ nagaram/ thethi/ vizha/ kadhal seidhi/ visesha nirdesangal/ anuppunur vivarangal.'
          },
          examples: [
            { lang: 'en', text: '"Deliver to John at 123 Main St, Colombo 05, 0771234567, this Friday, House, john@email.com, occasion: birthday, gift msg: Happy Birthday!, special: leave at door"' },
            { lang: 'si', text: '"ජෝන් වෙත 123 මේන් ස්ට්‍රීට්, කොළඹ 05, 0771234567, මෙම ශුක්‍රවාරය, නිවාස, john@email.com, සුළුසිරුර: උපන්දිනය, උපහාර පණිවුඩය: සුභ උපන්දිනය!, විශේෂ: දවස් පිට ඇඳ දෙන්න"'},
            { lang: 'sl', text: '"John wetha 123 Main Street, Colombo 05, 0771234567, me shukravaraya, niwasa, john@email.com, sulu sirura: upan dinaya, upahara pinividaya: Subha Upan Dinaya!, vishesha: davasa pita adina dennna"'},
            { lang: 'ta', text: '"ஜான் க்கு 123 மேன் சename, கொழும்பு 05, 0771234567, இந்த வெள்ளி, வீடு, john@email.com, விழா: பிறந்தநாள், காதல் செய்தி: இனிய பிறந்தநாள்!, விசேஷம்: கதவு முன் விட்டு விடுங்கள்"'},
            { lang: 'tl', text: '"John ku 123 Main Street, Kozhumbu 05, 0771234567, indha velli, veedu, john@email.com, vizha: pirandhanaal, kadhal seidhi: Iniya pirandhanaal!, visesham: kadavu mun vitu vidungal"'},
          ]
        },
        {
          title: { en: 'Transliteration (Unicode → English)', si: 'ලිපින්‍යාන්තරණය (Unicode → ඉංග්‍රීසි)', sl: 'Lipiyantharanaya (Unicode → English)', ta: 'எழுத்து மாற்றம் (Unicode → ஆங்கிலம்)', tl: 'Ezhuthu maatram (Unicode → English)' },
          desc: { 
            en: 'All name/address fields must be ASCII. TARA transliterates: "பிரியா" → "Priya", "සුරේෂ්" → "Suresh". Checkout also falls back to "Guest" if empty after cleaning.',
            si: 'සියලු නම/ලිපිනය ක්ෂේත්‍ර ASCII වශයෙන් විය යුතුය. TARA ලිපින්‍යාන්තරණය කරයි: "ප්‍රියා" → "Priya", "සුරේෂ්" → "Suresh"। චෙක්අවුට් සැකසීම අවහිර විය හැකිය.',
            sl: 'Sithulu nama/lipinaya kshetra ASCII wasayen vya yuthuyi. TARA lipiyantharanaya karayi: "Priya" → "Priya", "Suresh" → "Suresh". Check-out sakasimi awahira vya hakiyi.',
            ta: 'அனைத்து பெயர்/முகவரி புலங்களும் ASCII ஆக இருக்க வேண்டும். TARA எழுத்து மாற்றம் செய்யும்: "பிரியா" → "Priya", "சுரேஷ்" → "Suresh". செக்அவுட் மographeग நகர்த்தல் பின்பு "Guest" ஆக மாறும்.',
            tl: 'Anaithu peyar/mugavari pulangalum ASCII aaga irukka vendum. TARA ezhuthu maatram seiyum: "Priya" → "Priya", "Suresh" → "Suresh". Check-out maro kuvithal pinbu "Guest" aaga maarum.'
          },
          examples: [
            { lang: 'si', text: '"ප්‍රියාවට යවන්න" → TARA transliterates to "Priyawata yavanna"' },
            { lang: 'ta', text: '"கார்த்திக்கு அனுப்பு" → TARA transliterates to "Karthikku anuppu"' },
            { lang: 'tl', text: '"Karthikku anuppu" (already Tanglish) → passes through as-is' },
          ]
        },
        {
          title: { en: 'Date parsing (smart)', si: 'දිනය පරිශීලකරණය (දක්ෂ)', sl: 'Dinaya parishilekaranaya (Daksha)', ta: 'தேதி பகுப்பாய்வு (சீராக)', tl: 'Thethi paguppayvu (Seeraga)' },
          desc: { 
            en: 'DD/MM/YYYY (Sri Lanka) → if past, try MM/DD/YYYY → if still past, use tomorrow. Never shown to user.',
            si: 'DD/MM/YYYY (ශ්‍රී ලංකා) → අතීතයි නම් MM/DD/YYYY උත්සාහ කරන්න → එතැන්තෝම අතීතයි නම් හෙට යොදාගන්න. භාවිතාකරුවට දැක්වීමට නොදෙන්න.',
            sl: 'DD/MM/YYYY (Sri Lanka) → atithayi nam MM/DD/YYYY uthsaha karanna → etaththo atithayi nam heta yodaganna. Bawithakaruvata daekwima denna.',
            ta: 'DD/MM/YYYY (இலங்கை) → முந்திய தேதியாக இருந்தால் MM/DD/YYYY முயற்சி → இன்னும் முந்தியதானால் நாளை பயன்படுத்து. பயனருக்கு காட்டப்படாது.',
            tl: 'DD/MM/YYYY (Ilangai) → muthiya thethiyaagirundhaal MM/DD/YYYY muyarchi → innum muthiyathaanal naalai payanpaduthu. Payanarkku kaatupadadhu.'
          },
          examples: [
            { lang: 'en', text: '"Deliver on 18/07/2026" → July 18, 2026 (valid)' },
            { lang: 'en', text: '"Deliver on 07/18/2026" → July 18, 2026 (US format accepted if DD/MM fails)' },
            { lang: 'en', text: '"Deliver tomorrow" → auto-resolves to next day' },
          ]
        },
      ]
    },
    {
      id: 'payment',
      title: { en: 'In-App Payment', si: 'ඇප් තුළ ගෙවීම', sl: 'App thula dewima', ta: 'ஆப்பில் செலுத்துதல்', tl: 'Appil seluthuthal' },
      icon: '💳',
      items: [
        {
          title: { en: 'Pay without leaving TARA', si: 'TARA වෙතින් පිටතට යාමකිරීමක් නොව ගෙවන්න', sl: 'TARA wethin pita thak yamak nowa dewanne', ta: 'TARA-இல் இருந்து வெளியேறாமல் செலுத்து', tl: 'TARA-il irundhu veliyerraamal seluthu' },
          desc: { 
            en: 'After checkout, "Pay Now" opens Kapruka checkout in an iframe modal (90vw × 75vh). Fallback: "Open in new tab" if iframe blocked. CSP allows kapruka.com framing.',
            si: 'චෙක්අවුට් පසු "දැන් ගෙවන්න" Kapruka චෙක්අවුට් iframe modal එකක් (90vw × 75vh) තුළ විවෘත කරයි. විකල්පය: "නව ටැබ් එක්ක විවෘත කරන්න" iframe අවහිර වුවද. CSP kapruka.com framing අනුමත කරයි.',
            sl: 'Check-out pasu "Dan dewanne" Kapruka check-out iframe modal ekak (90vw × 75vh) thula vivruth karayi. Vikalpaya: "Nawa tab ekke vivruth karanna" iframe awahira wuna. CSP kapruka.com framing anumatha karayi.',
            ta: 'செக்அவுட் பிறகு "இப்போது செலுத்து" Kapruka செக்அவுட் ஐஃப்ரேம் மொடலில் (90vw × 75vh) திறக்கிறது. மாற்று: "புதிய ਟാബில் திறக்க" ஐஃப்ரேம் தடுக்கப்பட்டால். CSP kapruka.com ஃபிரேமிங் அனுமதிக்கிறது.',
            tl: 'Check-out pinbu "Ippodhu seluthu" Kapruka check-out iframe modalil (90vw × 75vh) thirakkirathu. Maatru: "Puthiya tabil thiraka" iframe thadukkappattal. CSP kapruka.com framing anumathikkirathu.'
          },
          examples: [
            { lang: 'en', text: 'CartDrawer "Pay Now" button OR ChatPanel receipt "Pay Now" button' },
            { lang: 'si', text: 'CartDrawer "දැන් ගෙවන්න" බොත්තම හෝ ChatPanel රසිද්  "දැන් ගෙවන්න" බොත්තම' },
            { lang: 'tl', text: 'CartDrawer "Pay Now" button allathu ChatPanel receipt "Pay Now" button' },
          ]
        },
      ]
    },
    {
      id: 'invoice',
      title: { en: 'PDF Invoice (Download + Share)', si: 'PDF ගාස්තු ලිපිය (බාගත් ගැනීම + බෙදාහැරීම)', sl: 'PDF gasthu lipiya (Bagatha gennima + Bedahaerima)', ta: 'PDF விலில்ագրம் (பதிவிறக்கம் + பகிர்வு)', tl: 'PDF vililagram (Padivirakkam + Pagirvu)' },
      icon: '📄',
      items: [
        {
          title: { en: 'AI-generated gift art + QR + full receipt', si: 'AI උපහාර කලාව + QR + සම්පූර්ණ රසිද්', sl: 'AI upahara kalaava + QR + sampoorna rasidhu', ta: 'AI காதல் கலை + QR + முழு رسید்', tl: 'AI kadhal kalai + QR + muzhu receipt' },
          desc: { 
            en: 'After order: "📄 Download AI Receipt" or Share button in chat receipt / CartDrawer. Generates PDF via html2canvas + jsPDF with QR code linking to Kapruka checkout, AI gift-card art (FLUX/SDXL), line items, totals, special instructions.',
            si: 'යෝජනා පසු: අරට්ටියේ රසිද් / CartDrawer තුළ "📄 AI රසිද් බාගත් ගන්න" හෝ Share බොත්තම. html2canvas + jsPDF මගින් PDF නිෂ්පාදනය වේ — Kapruka චෙක්අවුට් සම්බන්ධ QR කේත, AI උපහාර කාඩ් කලාව (FLUX/SDXL), රේඛා අයිතම්, එකතු වැඩි, විශේෂ නිර්දේශ.',
            sl: 'Yojnava pasu: aratiyge rasidhu / CartDrawer thula "📄 AI rasidhu bagatha ganna" ho Share button. html2canvas + jsPDF magein PDF nishpadanaya ve — Kapruka check-out sambandha QR koodu, AI upahara card kalawa (FLUX/SDXL), rekha ayitham, ekathu wadi, vishesha nirdeshaya.',
            ta: 'ஆர்டர் பின்: அரட்டையில் residues / CartDrawer இல் "📄 AI رسید் பதிவிறக்கு" அல்லது பகிர் பொத்தான். html2canvas + jsPDF மூலம் PDF உருவாக்கம் — Kapruka செக்அவுட் இணைப்பு QR குறியீடு, AI காதல் கார்டு கலை (FLUX/SDXL), வரிசை मदங்கள், மொத்தம், விசேஷ நிர்வாகங்கள்.',
            tl: 'Order pinbu: arattaiyil receipt / CartDrawer il "📄 AI receipt padivirakka" allathu Share button. html2canvas + jsPDF moolam PDF uruvakkam — Kapruka check-out link QR code, AI kadhal card kalai (FLUX/SDXL), varisai items, muthal, visesha nirdesangal.'
          },
          examples: [
            { lang: 'en', text: 'Chat receipt shows "📄 Download AI Receipt" / "Share Receipt" buttons' },
            { lang: 'si', text: 'රසිද්හි "📄 AI රසිද් බාගත් ගන්න" / "රසිද් බෙදාහැරන්න" බොත්තම් පෙනේ' },
            { lang: 'tl', text: 'Receipt-il "📄 Download AI Receipt" / "Share Receipt" buttons kaanum' },
          ]
        },
      ]
    },
    {
      id: 'tracking',
      title: { en: 'Track Order', si: 'යෝජනා ප්‍රතිපාදනය', sl: 'Yojanava prathipadanaya', ta: 'ஆர்டர் பயன்பாடு', tl: 'Order payanpaduthal' },
      icon: '📦',
      items: [
        {
          title: { en: 'Sidebar Track Order panel / chat command', si: 'සයිඩ්බාර් Track Order පැනෙල් / කතා වැඩසටහන', sl: 'Sidebar Track Order panel / katha vadasathana', ta: 'சைட்பார் Track Order பணல் / அரட்டை கட்டளை', tl: 'Sidebar Track Order panel / arattai kattalai' },
          desc: { 
            en: 'Desktop: sidebar → Track Order (📦 icon). Mobile: hamburger → Track Order. Or just type "Track KAP123456" in chat. Shows live status: Received → Confirmed → Out for delivery → Delivered, with timeline.',
            si: 'ඩෙස්ක්ටොප්: සයිඩ්බාර් → Track Order (📦 අකුරු). ජංගම: හැම්බර්ගර් → Track Order. හෝ කතාවේ�තුළ "Track KAP123456" ලියන්න. සාවාදීය තත්ත්වය පෙන්වයි: ලැබුණු → තහවුරු කළ → ලබාදීමට පිටත් → ලබා දීම සහ කාල සටහන.',
            sl: 'Desktop: sidebar → Track Order (📦 akuru). Mobile: hamburger → Track Order. Ho kathawthula "Track KAP123456" liyanna. Savadhiya thiththaya penveyi: laabuna → thahawuru kara → labadimata pita → labba diima saha kala sathahan.',
            ta: 'டெஸ்க்டாப்: சைட்பார் → Track Order (📦 சின்னம்). மொபைல்: ஹம்பெர்கர் → Track Order. அல்லது அரட்டையில் "Track KAP123456" எனத் தட்டச்சு செய்யவும். நேரடி நிலை: பெறப்பட்டது → உறுதிப்படுத்தப்பட்டது → வழங்குவதற்காக வெளியே → வழங்கப்பட்டது, கால அட்டவணை உடன்.',
            tl: 'Desktop: sidebar → Track Order (📦 icon). Mobile: hamburger → Track Order. Allathu arattaiyil "Track KAP123456" ena thattachu seiyavum. Neradi nilai: perappattathu → uruthipadaithu → vangaippadaga veliye → vangaipattathu, kaala attavanai udan.'
          },
          examples: [
            { lang: 'en', text: '"Track VIMP34456CB2"' },
            { lang: 'si', text: '"Track VIMP34456CB2"' },
            { lang: 'tl', text: '"Track VIMP34456CB2"' },
          ]
        },
      ]
    },
    {
      id: 'notifications',
      title: { en: 'Chat Notifications', si: 'කතා දැනුම්', sl: 'Katha danuma', ta: 'அரட்டை எச்சரிக்கைகள்', tl: 'Arattai echarikkai' },
      icon: '🔔',
      items: [
        {
          title: { en: 'Cart actions + receipts appear in chat', si: 'කාට් ක්‍රියාවලිය + රසිද් කතාවේ පෙනේ', sl: 'Cart kriyavali + rasidhu kathawe penne', ta: 'கார்ட் செயல்பாடுகள் + رسید் அரட்டையில் தோன்றும்', tl: 'Cart seyalpugal + receipt arattaiyil thonrum' },
          desc: { 
            en: 'Add/remove/update cart → "🛒 Added X to cart" / "🗑️ Removed X" / "📦 Updated X qty to N". Checkout success → full receipt with product images (44×44), all details, totals, "📄 Download AI Receipt" / "Share Receipt" buttons. Errors → "⚠️ Checkout issue: {error}".',
            si: 'එකතු කිරීම/ඉවත් කිරීම/යාවත්කාලීන කාට් → "🛒 X එක් කළ කාට්ට" / "🗑️ X ඉවත් කළා" / "📦 X ප්‍රමාණය N දක්වා යාවත්කාලීන කළා". චෙක්අවුට් සාර්ථක → භාණ්ඩ පින්තූර (44×44), සියලු විස්තර, එකතු වැඩි, "📄 AI රසිද් බාගත් ගන්න" / "රසිද් බෙදාහැරන්න" බොත්තම්. දෝෂ → "⚠️ චෙක්අවුට් ගැටළුව: {error}".',
            sl: 'Ekathu karanna/ iwath karanna/ yawathakalin karanna kathu → "🛒 X ekathu kala kaththak" / "🗑️ X iwath kal" / "📦 X pramanaya N dakwa yawathakalin kal". Check-out saratha → bhandha pinthuru (44×44), sithulu vistara, ekathu wadi, "📄 AI rasidhu bagatha ganna" / "rasidhu bedaheranna" button. Dhosha → "⚠️ Check-out gatilava: {error}".',
            ta: 'கூட்டு/நீக்கு/புதுப்பிக்க கார்ட் → "🛒 X கார்ட்டில் சேர்க்கப்பட்டது" / "🗑️ X நீக்கப்பட்டது" / "📦 X அளவு N ஆக புதுப்பிக்கப்பட்டது". செக்அவுட் வெற்றி → உற்பொருள் படங்கள் (44×44), அனைத்து விவரங்கள், மொத்தம், "📄 AI رسید் பதிவிறக்கு" / "பகிர்வு" பொத்தான்கள். பிழைகள் → "⚠️ செக்அவுட் சிக்கல்: {error}".',
            tl: 'Serku/nikka/pudupikka cart → "🛒 X cartil serkkappattathu" / "🗑️ X nikkappattathu" / "📦 X alavu N aaga pudupikkappattathu". Check-out vetri → porul padangal (44×44), ella vivarangalum, muthal, "📄 AI receipt padivirakka" / "Share Receipt" buttons. Pizhaigal → "⚠️ Check-out sikkal: {error}".'
          },
          examples: [
            { lang: 'en', text: 'Add iPhone to cart → chat shows "🛒 Added iPhone 16 Pro to cart"' },
            { lang: 'si', text: 'iPhone එක් කාට් එක් කිරීම → කතාව "🛒 iPhone 16 Pro එක් කළ කාට්ට" පෙන්වේ' },
            { lang: 'tl', text: 'iPhone cartil serkkal → arattai "🛒 iPhone 16 Pro cartil serkkappattathu" kaanum' },
          ]
        },
      ]
    },
    {
      id: 'history',
      title: { en: 'Order History & Reorder', si: 'යෝජනා ඉතිහාසය හා නැවත යෝජනා', sl: 'Yojanava ithihasaya ha nawa yojanava', ta: 'ஆர்டர் வரலாறு மற்றும் மீண்டும் ஆர்டர்', tl: 'Order varalaru matrum mudintha order' },
      icon: '📋',
      items: [
        {
          title: { en: 'Sidebar History panel (collapsible rows)', si: 'සයිඩ්බාර් History පැනෙල් (කුඩා කළ හැකි පේළි)', sl: 'Sidebar History panel (kuda karanna pulu pili)', ta: 'சைட்பார் History Panel (சுருக்கத்தக்க வரிகள்)', tl: 'Sidebar History panel (surukkathakka varigal)' },
          desc: { 
            en: 'Up to 20 orders stored locally (localStorage). Click any row to expand → see items, prices, thumbnails. "Reorder" in chat reorder card rebuilds the cart in one tap.',
            si: 'ඉහළම 20 යෝජනා ස්වයංයෙන් සුරාක්ෂිත (localStorage). කෝවී පේළිය ක්ලික් කර විස්තාර කරන්න → අයිතම්, මිල, සුළු පින්තූර බලන්න. කතාවේ "Reorder" කාඩ් කාට් එක්තු කළ පසු වෙන්ව යෝජනා කරයි.',
            sl: 'Upama 20 yojanava swayange surakshitha (localStorage). Kowi peliya click karanna vistara karanna → ayitham, mila, sula pinthura balanna. Kathawe "Reorder" card kathu ekathu karanna pasu wenew yojanava karayi.',
            ta: 'அதிகபட்சம் 20 ஆர்டர்கள் உள்ளூர் சேமிப்பில் (localStorage). ஏதேனும் வரியைக் கிளிக் செய்து விரிவாக்கு → பொருட்கள், விலைகள், சிறு படங்கள் காண்க. அரட்டையில் "Reorder" கார்ட் கார்டை ஒரு தட்டில் மறுபடியும் உருவாக்குகிறது.',
            tl: 'Adhikapadam 20 orders localStorage-il surakshitha. Yaethenum variyai click seiyu virivakku → items, viligal, sula padangal kaanum. Arattaiyil "Reorder" card cardai oru thattil marupadiyum uruvakkirathu.'
          },
          examples: [
            { lang: 'en', text: 'Sidebar → History → click order → "Reorder" in chat' },
            { lang: 'si', text: 'Sidebar → ඉතිහාසය → යෝජනා ක්ලික් → කතාවේ "Reorder"' },
            { lang: 'tl', text: 'Sidebar → History → order click → arattaiyil "Reorder"' },
          ]
        },
      ]
    },
    {
      id: 'rewards',
      title: { en: 'Rewards (Coming Soon)', si: 'සාධනා (ඉන්නවත් වනවා)', sl: 'Sadhana (Innawath wenawa)', ta: 'பரிசுக்கள் (வருந்தしている)', tl: 'Parishukkal (Varuthirukku)' },
      icon: '⭐',
      items: [
        {
          title: { en: 'Points for orders, reviews, gifts, expat mode', si: 'යෝජනා, මූල්‍යන්ත්‍රණ, උපහාර, එක්ස්පැට් mood සඳහා පොයින්ට්ස්', sl: 'Yojanava, mulyayanthranaya, upahara, expat mood saha points', ta: 'ஆர்டர்கள், விமர்சனங்கள், காதல்கள், expat mode உடன் பாயின்ட்கள்', tl: 'Orders, reviews, kadhal, expat mode saha points' },
          desc: { 
            en: 'Sidebar → Rewards shows progress. First order +50, Rate product +10, Expat order +25, Send gift +15. Not yet redeemable — UI scaffold only.',
            si: 'සයිඩ්බාර් → Rewards ප්‍රගති පෙන්වේ. පළමු යෝජනා +50, භාණ්ඩ මූල්‍යන්ත්‍රණ +10, Expat යෝජනා +25, උපහාර යවීම +15. තවම යෙදවීමට නොහැක — UI සම්ප්‍රාදායික පමණි.',
            sl: 'Sidebar → Rewards pragthi penveyi. Prathama yojanava +50, bhandha mulyayanthranaya +10, Expat yojanava +25, upahara yavidima +15. Thawa yedawimata nowi — UI sampraadayika pamanai.',
            ta: 'சைட்பார் → Rewards முன்னேற்றம் காட்டும். முதல் ஆர்டர் +50, உற்பொருள் மதிப்பீடு +10, Expat ஆர்டர் +25, காதல் அனுப்புதல் +15. இன்னும் வாங்கத் தேவையில்லை — UI மட்டுமே.',
            tl: 'Sidebar → Rewards munnettam kaatutum. Muthal order +50, porul matipidu +10, Expat order +25, kadhal anupputhal +15. Innrum vaangatha thevaiyillai — UI mattum.'
          },
          examples: [
            { lang: 'en', text: 'Sidebar → Rewards to see your points' },
            { lang: 'si', text: 'සයිඩ්බාර් → Rewards ඔබේ පොයින්ට්ස් බලන්න' },
            { lang: 'tl', text: 'Sidebar → Rewards ungal points paakka' },
          ]
        },
      ]
    },
    {
      id: 'categories',
      title: { en: 'Browse Categories (3-Level Drill-Down)', si: 'ප්‍රවර්ග හැරීම (3-ම මට්ටම පහළට)', sl: 'Prawarga haerima (3-weni mattama palata)', ta: 'வகை புலங்களை உலாவு (3-நிலை تلاش்-டவுன்)', tl: 'Vagai pulangalai ulaavu (3-nilai drill-down)' },
      icon: '🗂️',
      items: [
        {
          title: { en: 'Live MCP categories with search', si: 'සක්‍රීය MCP ප්‍රවර්ග සොයීමෙන් සහිත', sl: 'Jeevana MCP prawarga soyiya saha', ta: 'நேரடி MCP வகைகள் தேடலுடன்', tl: 'Neradi MCP vagai thaedaludan' },
          desc: { 
            en: 'Sidebar → Browse. Level 1: top categories (Flowers, Cakes, Electronics…). Click → Level 2 subcategories. Click subcategory with URL → Level 3 scraped sub-subcategories. Search bar filters all levels. Click any leaf → fires search in chat.',
            si: 'සයිඩ්බාර් → හැරීම. මට්ටම 1: උසම ප්‍රවර්ග (මල්, කේක්, ඊලෙක්ට්‍රොනික්…). ක්ලික් → මට්ටම 2 උපප්‍රවර්ග. URL සහිත උපප්‍රවර්ග ක්ලික් → මට්ටම 3 අඩු උප-උපප්‍රවර්ග. සොයුම් තීරුව සියලු මට්ටම් පෙරහැරීමට. කෝවී පුරාව ක්ලික් → කතාවේ සොයුම් ක්‍රියාත්මක.',
            sl: 'Sidebar → Haerima. Mattama 1: usama prawarga (Mal, Cake, Electronics...). Click → Mattama 2 upa-prawarga. URL sahith upa-prawarga click → Mattama 3 adi upa-upa-prawarga. Soyiya thiruwa sithulu mattam peraherima. Kowi purava click → kathawe soyiya kriyathmaka.',
            ta: 'சைட்பார் → உலாவு. நிலை 1: cima வகைகள் (மலர்கள், கேக்குகள், மின்னணுவியல்…). கிளிக் → நிலை 2 ഉപவகைகள். URL உடன் உபவகை கிளிக் → நிலை 3 சிறிய உப-உபவகைகள். தேடல் தட்டை அனைத்து நிலைகளையும் வடிகட்டுகிறது. எந்த இலைக்குள் கிளிக் → அரட்டையில் தேடல் தொடங்குகிறது.',
            tl: 'Sidebar → Ulaavu. Nilai 1: cima vagai (Malar, Cake, Electronics...). Click → Nilai 2 upavagai. URL udan upavagai click → Nilai 3 sinna upa-upavagai. Thaedal thattai ella nilaiyayum vadikattirukirathu. Yaethenum ilaikku click → arattaiyil thaedal thodangirathu.'
          },
          examples: [
            { lang: 'en', text: 'Sidebar → Browse → Flowers → Roses → Red Roses' },
            { lang: 'si', text: 'සයිඩ්බාර් → හැරීම → මල් → රෝස් → රතු රෝස්' },
            { lang: 'tl', text: 'Sidebar → Browse → Flowers → Roses → Red Roses' },
          ]
        },
      ]
    },
    {
      id: 'expat',
      title: { en: 'Expat / Diaspora Mode', si: 'එක්ස්පැට් / Diaspora මෝඩ්', sl: 'Expat / Diaspora mode', ta: 'Expat / Diaspora தொடர்', tl: 'Expat / Diaspora mode' },
      icon: '🌍',
      items: [
        {
          title: { en: 'Auto-detect or manual toggle', si: 'ස්වයං හඳුනාගැනීම හෝ කාර්යකාරී මාරුව', sl: 'Swayang haduna genima ho karyakari maruwa', ta: 'தானாக கண்டுபிடித்தல் அல்லது கையாள் முன்கூறல்', tl: 'Thaanaga kandupidithal allathu kaiyal mungural' },
          desc: { 
            en: 'Say "I\'m ordering from abroad" or click the banner. TARA switches persona — warmer tone, international shipping guidance, currency hints. Persists across session.',
            si: '"මම විදේශයෙන් යෝජනා කරනවා" කියන්න හෝ බැනර් ක්ලික් කරන්න. TARA චරිතය මාරු කරයි — වැඩි සුහද ආකාරය, ජාත්‍යන්තර යවීමේ මඟදීම, මුදල් ආකාර සංකේත. සැසිය අවසාන දක්වා නවත්වයි.',
            sl: '"Mama videshayen yojanava karanawa" kiyanna ho banner click karanna. TARA charithaya maru karayi — wadi suhada akaraya, jathyanthara yavimange madima, mudal akara sanketha. Seseyi awasan dawasa nawathwayi.',
            ta: '"நான் வெளிநாட்டிலிருந்து ஆர்டர் செய்கிறேன்" என்று சொல்லுங்கள் அல்லது பேனரைக் கிளிக் செய்யவும். TARA வட்டி மாறுகிறது — அதிக ஆவேசம், சர்வதேசக் கப்பல் வழி வழிகாட்டுதல், மुद्रை முப்பொருள். அமர்வு முடியேனும் தொடர்கிறது.',
            tl: '"Naan velinattilirundhu order seikiren" endru solungal allathu bannerai click seiyavum. TARA vatti maarirukirathu — adhika aavesam, sarvadesak kappal vali vazhikaattuthal, muthalai mupporul. Amavu mudiyenum thodarum.'
          },
          examples: [
            { lang: 'en', text: '"I\'m ordering from Australia" → Expat banner appears, TARA adjusts tone' },
            { lang: 'si', text: '"මම ඕස්ට්‍රේලියාවෙන් යෝජනා කරනවා" → Expat බැනර් පෙනේ, TARA ආකාර වෙනස් වේ' },
            { lang: 'tl', text: '"Naan Australia-irundhu order seikiren" → Expat banner kaanum, TARA aakaaru maarum' },
          ]
        },
      ]
    },
    {
      id: 'agentic',
      title: { en: 'Agentic Thought Process (Reasoning UI)', si: 'එජන්ටික් මනෝවිද්‍යාව (හේතු දර්ශන UI)', sl: 'Agentic manovidya (Hethu darshana UI)', ta: 'அயంత్ర கருத்து செயல்முறை (காரண இயக்க UI)', tl: 'Agentic karuthu seyalmurai (Kaaran iyakka UI)' },
      icon: '🧠',
      items: [
        {
          title: { en: 'ThinkingPulse (loading) + ThinkingDrawer (collapsible)', si: 'ThinkingPulse (පූරණය) + ThinkingDrawer (කුඩා කළ හැකි)', sl: 'ThinkingPulse (poornaya) + ThinkingDrawer (kuda karanna pulu)', ta: 'ThinkingPulse (ஏற்றம்) + ThinkingDrawer (சுருக்கக்கூடிய)', tl: 'ThinkingPulse (ertham) + ThinkingDrawer (surukkakoodiya)' },
          desc: { 
            en: 'Every TARA reply starts with <tara_thinking> JSON (intent, goal, constraints, plan). Server strips it, sends via X-Tara-Thinking header. ChatPanel shows "🧠 Show TARA\'s Reasoning" pill on completed messages. Click → staggered green checkmarks animate. Upsell steps filtered out.',
            si: 'ප්‍රති යෝජනාවක් <tara_thinking> JSON (අරමුණ, ඉලක්කය, සීමා, වැඩසටහන) සමඟ ආරම්භ වේ. සේවාදායක එය ඉවත් කර X-Tara-Thinking හිතුවෙන් යවයි. ChatPanel "🧠 TARAගේ හේතු දර්ශනය පෙන්වන්න" පිල් පෙන්වේ. ක්ලික් → ස්ථිර ලෙස ලස් අලුත් ගැල් චින්නන් දැක්වේ. උපසෙල් දියවැඩියාව ඉවත් කළ හැකි.',
            sl: 'Prathi yojanava <tara_thinking> JSON (aramuna, ilakkaya, seema, wadahathara) saha arambha ve. Sevadhyaka eya iwath kara X-Tara-Thinking hithuwen yavayi. ChatPanel "🧠 TARAge hethu darshanaya penvanna" pil penveyi. Click → sthira lesa lusa aluth gal chinnangalu dakave. Upasela diyawadiya iwath kara shakthi.',
            ta: 'ஒவ்வொரு TARA பதிலும் <tara_thinking> JSON (நימוஷம், இலக்கு, வரம்புகள், திட்டம்) உடன் தொடங்கும். சேவையகம் அதை நீக்கி X-Tara-Thinking தலைப்பில் அனுப்புகிறது. ChatPanel "🧠 TARA-யின் கருத்து காட்டு" பிலைக் காட்டுகிறது. கிளிக் → நிலைநிலையாக விட்டு விட்டு பச்சை சektion்கள் ஆனிமேட் ஆகும். உப்பூசல் படிகள் விலக்கப்படுகின்றன.',
            tl: 'Oru TARA pathilum <tara_thinking> JSON (nimosham, ilakku, varampugal, thittam) udan thodangum. Sevaiyakam aya neeki X-Tara-Thinking thalaipil anuppirukirathu. ChatPanel "🧠 TARA-in karuthu kaatu" pillai kaatirukirathu. Click → nilaianilaiyaaga vitu vitu pachai sectiongal animate aakum. Uppusal padigal vilakkappattana.'
          },
          examples: [
            { lang: 'en', text: 'After reply, click "🧠 Show TARA\'s Reasoning" pill' },
            { lang: 'si', text: 'ප්‍රතිචාර පසු "🧠 TARAගේ හේතු දර්ශනය පෙන්වන්න" පිල් ක්ලික් කරන්න' },
            { lang: 'tl', text: 'Pathil pinbu "🧠 TARA-in Karuthu Kattu" pillai click seiyungal' },
          ]
        },
      ]
    },
    {
      id: 'gift-chains',
      title: { en: 'Gift Chain Upselling', si: 'උපහාර ශෘංඛලා උපරිම කිරීම', sl: 'Upahara shrunkhala uparima kirima', ta: 'காதல் சங்கிலி மேல்நிறுத்தல்', tl: 'Kadhal sangili melniruthal' },
      icon: '🎁',
      items: [
        {
          title: { en: '8 chains, max 2 follow-ups, 5 languages', si: '8 ශෘංඛලා, උපරිම 2 අනුපූර්ව පිළිතුරු, 5 භාෂා', sl: '8 shrunkhala, uparima 2 anupurwa pilithuru, 5 bhasha', ta: '8 சங்கிலிகள், அதிகபட்சம் 2 பின்தொடர்கள், 5 மொழிகள்', tl: '8 sangiligal, adhikapadam 2 pinnar, 5 mozhi' },
          desc: { 
            en: 'Roses→Chocolates→Card/Toy, Cake→Flowers→Chocolates, Chocolate→Toy→Card, Toy→Chocolate→Card, Hamper→Card→Balloon, Perfume→Chocolate→Box, Phone→Case→Screen Guard, Laptop→Bag→Mouse. Say "yes/ok/awa/ஆமா/aama/ඔව්" to continue, "no/nehe/illa/vendaam" to stop.',
            si: 'මල්→චොක්ලට්→කාඩ්/ක්‍රීඩා, කේක්→මල්→චොක්ලට්, චොක්ලට්→ක්‍රීඩා→කාඩ්, ක්‍රීඩා→චොක්ලට්→කාඩ්, හැම්පර්→කාඩ්→බැලුන්, සුගන්ධ→චොක්ලට්→බොක්ස්, දුරකථනය→කවර්→ස්ක්‍රීන් ආරක්ෂක, ලැප්ටොප්→බැග්→මවුස්. "ඔව්/හොඳි/ඔව්/ඔව්" කියලා ඉදිරියට, "නැහැ/නෑ/ඉල්ල/වෙන්දාම්" කියලා නවත්වන්න.',
            sl: 'Mal→Chocolate→Card/Krida, Cake→Mal→Chocolate, Chocolate→Krida→Card, Krida→Chocolate→Card, Hamper→Card→Balloon, Suganda→Chocolate→Box, Durakathanaya→Kawar→Screen Arakshaka, Laptop→Bag→Mouse. "Ow/hodai/owa/ow" kiyala idiriya, "nae/nae/illa/vendam" kiyala nawathwanna.',
            ta: 'மலர்கள்→சாக்லேட்கள்→கார்டு/விளையாட்டு, கேக்→மலர்கள்→சாக்லேட்கள், சாக்லேட்→விளையாட்டு→கார்டு, விளையாட்டு→சாக்லேட்→கார்டு, ஹேம்பர்→கார்டு→பூச்சாட்டு, மணம்→சாக்லேட்→பெட்டி, தொலைபேசி→கவர்→ஸ்கிரீன் பாதுகாப்பு, லேப்டاپ்→பேக்→மவுஸ். "ஆமாம்/சரி/ஆமா/ஆமாம்" எனச் சொல்லி தொடர, "இல்லை/அதில்லை/வேண்டாம்" எனச் சொல்லி நிறுத்து.',
            tl: 'Malar→Chocolate→Card/Toy, Cake→Malar→Chocolate, Chocolate→Toy→Card, Toy→Chocolate→Card, Hamper→Card→Balloon, Manam→Chocolate→Box, Phone→Cover→Screen Guard, Laptop→Bag→Mouse. "Aama/seri/aama/aama" enna solil thodaru, "Illai/adillai/vendam" enna solil niruthu.'
          },
          examples: [
            { lang: 'en', text: 'TARA: "Want roses?" → You: "yes" → TARA shows chocolates → You: "yes" → TARA shows cards' },
            { lang: 'si', text: 'TARA: "මල් අවශ්‍යද?" → ඔබ: "ඔව්" → TARA චොක්ලට් පෙන්වේ → ඔබ: "ඔව්" → TARA කාඩ් පෙන්වේ' },
            { lang: 'tl', text: 'TARA: "Malar avashyama?" → Nee: "Aama" → TARA chocolate kaanum → Nee: "Aama" → TARA card kaanum' },
          ]
        },
      ]
    },
    {
      id: 'quick-chips',
      title: { en: 'Quick-Action Chips', si: 'ඉක්මන් ක්‍රියා චිප්ස්', sl: 'Ikamank kriya chips', ta: 'உடனடி செயல் சிப்ஸ்கள்', tl: 'Udanadi seyal chips' },
      icon: '💡',
      items: [
        {
          title: { en: 'Preserve language across quick replies', si: 'ඉක්මන් පිළිතුරු අතර භාෂාව පවත්වා ගැනීම', sl: 'Ikamank pilithuru athara bhashava paaththaa genima', ta: 'உடனடி பதில்கள் இடையே மொழியைப் பேரும்படி', tl: 'Udanadi pathilgal idaiye mozhiya perum paddi' },
          desc: { 
            en: 'Chips under TARA replies (e.g. "Track order", "Browse cakes", "Talk to agent"). Clicking sends forced language so detection doesn\'t reset.',
            si: 'TARA ප්‍රතිචාර පහළ චිප්ස් (උදා: "යෝජනා ප්‍රතිපාදනය", "කේක් හැරීම", "නියෝජිතාව සමඟ කතා කරන්න"). ක්ලික් කිරීම forceLang යවයි — හඳුනාගැනීම නැවත ආරම්භ නොවේ.',
            sl: 'TARA prathichara pala chisp (udaharan: "Yojanava prathipadanaya", "Cake haerima", "Niyojithawa saha katha karanna"). Click karanawa forceLang yavayi — haduna genima nawa arambha nowhe.',
            ta: 'TARA பதில் கீழ் சிப்ஸ் (எ.கா. "ஆர்டர் பயன்பாடு", "கேக்குகள் உலாவு", "நியமித்துவரோடு பேசு"). கிளிக் செய்தால் forceLang அனுப்புகிறது — கண்டுபிடிப்பு மீண்டும் தொடங்காது.',
            tl: 'TARA pathil keel chips (udaaharan: "Order payanpaduthal", "Cakes ulaavu", "Agent-odu pesu"). Click seithaal forceLang anuppirukirathu — kandupidippu mudinthal thodangadhu.'
          },
          examples: [
            { lang: 'en', text: 'Click "Track order" chip → sends with current language locked' },
            { lang: 'si', text: '"යෝජනා ප්‍රතිපාදනය" chip ක්ලික් → වර්තමාන භාෂාව තහවුරු කර යවයි' },
            { lang: 'tl', text: '"Track order" chip click → current mozhi lock aaga anuppirukirathu' },
          ]
        },
      ]
    },
    {
      id: 'settings',
      title: { en: 'Settings Panel', si: 'සැකසුම් පැනෙල්', sl: 'Sakasum panel', ta: 'அமைப்பு பலகை', tl: 'Amaippu palagai' },
      icon: '⚙️',
      items: [
        {
          title: { en: 'Language pills (5 languages)', si: 'භාෂා පිල් (5 භාෂා)', sl: 'Bhasha pil (5 bhasha)', ta: 'மொழி பெட்டிகள் (5 மொழிகள்)', tl: 'Mozhi pettigal (5 mozhi)' },
          desc: { 
            en: 'Sidebar → Settings → click any language pill (🇬🇧 English, 🇱🇰 සිංහල, 🇱🇰 Sihalish, 🇱🇰 தமிழ், 🇱🇰 Tanglish). Active pill highlighted. Persists across reloads.',
            si: 'සයිඩ්බාර් → සැකසුම් → කෝවී භාෂා පිල් ක්ලික් කරන්න (🇬🇧 English, 🇱🇰 සිංහල, 🇱🇰 Sihalish, 🇱🇰 தமிழ், 🇱🇰 Tanglish). ක්‍රියාත්මක පිල් ප්‍රභාවිත වේ. නැවත ලෝඩ් වීමේදී තහවුරු.',
            sl: 'Sidebar → Sakasum → kowi bhasha pil click karanna (🇬🇧 English, 🇱🇰 Sinhala, 🇱🇰 Sihalish, 🇱🇰 Tamil, 🇱🇰 Tanglish). Kriyathmaka pil prabhavitha ve. Nawa load veedi thahuwa.',
            ta: 'சைட்பார் → அமைப்பு → ஏதேனும் மொழி பெட்டியைக் கிளிக் செய்யவும் (🇬🇧 English, 🇱🇰 සිංහල, 🇱🇰 Sihalish, 🇱🇰 தமிழ், 🇱🇰 Tanglish). செயல்படும் பெட்டி கலமானது. மீண்டும் ஏற்றும்போது நிலைத்திருக்கிறது.',
            tl: 'Sidebar → Settings → yaethenum mozhi pettiyai click seiyavum (🇬🇧 English, 🇱🇰 Sinhala, 🇱🇰 Sihalish, 🇱🇰 Tamil, 🇱🇰 Tanglish). Seyalpadum petti kalamanaadhu. Mudinthal ethirumbothu nilaithirukirathu.'
          },
          examples: [
            { lang: 'en', text: 'Click 🇱🇰 தமிழ் → all TARA replies switch to Tamil' },
            { lang: 'si', text: '🇱🇰 தமிழ் ක්ලික් → සියලු TARA ප්‍රතිචාර දෙමළට මාරු වේ' },
            { lang: 'tl', text: 'Click 🇱🇰 தமிழ் → ella TARA replies Tamilukku maarum' },
          ]
        },
        {
          title: { en: 'Speaker toggle (🔊/🔇)', si: 'ශ්‍රවක මාරුව (🔊/🔇)', sl: 'Shrawaka maruwa (🔊/🔇)', ta: 'ஸ்பீకర் முன்கூறல் (🔊/🔇)', tl: 'Speaker mungural (🔊/🔇)' },
          desc: { 
            en: 'Top-right of app header. Turns off TTS playback only — STT and hands-free loop still run. Useful for silent environments.',
            si: 'යෝජනා හැඩේ දකුණු ඉහළ. පාඨයෙන් ශබ්දයට පත් කිරීම පමණක් අවසන් කරයි — STT හා මුළු ප්‍රමාණයෙන් චක්‍රය දැනුම් දෙයි. නිශ්ශබ්ද පරිශ්‍රයන්ට උපකාරී.',
            sl: 'Yojanava hadae dakuna iha. Pathayen shabdhayak pataw karanama pamanak awasan karayi — STT ha mul pramanayen chakraya danuma deyayi. Nishabda parishrayanth upakarayi.',
            ta: 'பயன்பாட்டின் வலது மேல். TTS வேளை மட்டுமே நிறுத்துகிறது — STT மற்றும் முழு சுழற்சி தொடரும். மௌன சுற்றுச்சூழலுக்கு உதவுகிறது.',
            tl: 'App-in valathu mel. TTS velai mattume niruthirukirathu — STT matrum muzhumai sulchi thodarum. Mounna suruchuchulalukku udhavirukirathu.'
          },
          examples: [
            { lang: 'en', text: 'Click 🔇 in header → TARA stops speaking but still listens' },
            { lang: 'si', text: 'හැඩේ 🔇 ක්ලික් → TARA කතා කිරීම අවසන් වේ, නමුත් සියෙන් අතිරේක්ෂක වේ' },
            { lang: 'tl', text: 'Header-il 🔇 click → TARA pesa mudiyum, naan unmai kelkiren' },
          ]
        },
      ]
    },
    {
      id: 'help',
      title: { en: 'Help & FAQ', si: 'උදව් හා FAQ', sl: 'Udhava ha FAQ', ta: 'உதவி மற்றும் FAQ', tl: 'Udhavi matrum FAQ' },
      icon: '❓',
      items: [
        {
          title: { en: 'Common questions answered', si: 'සාමාන්‍ය ප්‍රශ්න පිළිතුරු', sl: 'Samanaya prashna pilithuru', ta: 'பொது கேள்விகள் பதில்கள்', tl: 'Podhu kelvigal pathilgal' },
          desc: { 
            en: 'Sidebar → Help. Expandable FAQ: How to order, languages, payment, expat, delivery, tracking. All answers in current language.',
            si: 'සයිඩ්බාර් → උදව්. විස්තාර හැකි FAQ: යෝජනා කිරීම, භාෂා, ගෙවීම, එක්ස්පැට්, ලබාදීම, ප්‍රතිපාදනය. සියලු පිළිතුරු වර්තමාන භාෂාවෙන්.',
            sl: 'Sidebar → Udhava. Vistara ha FAQ: Yojanava karima, bhasha, dewima, expat, labadima, prathipadanaya. Sithulu pilithuru varthamana bhasha wen.',
            ta: 'சைட்பார் → உதவி. விரிவாக்கக்கூடிய FAQ: ஆர்டர் செய்வது, மொழிகள், செலுத்துதல், Expat, வழங்குதல், பயன்பாடு. அனைத்து பதில்களும் നിലവில舅 மொழியில்.',
            tl: 'Sidebar → Udhavi. Virivakkoodiya FAQ: Order seivathu, mozhi, seluthuthal, Expat, vangaippadhu, payanpaduthal. Ella pathilgalum varthamana mozhi-yil.'
          },
          examples: [],
        },
      ]
    },
  ];

  const renderSection = (section: typeof sections[0]) => {
    const t = section.title[lang as keyof typeof section.title] || section.title.en;
    return (
      <details key={section.id} style={{ marginBottom: 16 }}>
        <summary style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', borderRadius: 10,
          background: 'var(--c-surface-container)',
          border: '1px solid rgba(74,68,81,0.25)',
          cursor: 'pointer', fontSize: 13, fontWeight: 700,
          color: 'var(--c-on-surface)', listStyle: 'none',
          fontFamily: 'var(--font-body)',
        }}>
          <span style={{ fontSize: 20 }}>{section.icon}</span>
          <span>{t}</span>
        </summary>
        <div style={{ padding: '12px 4px 4px' }}>
          {section.items.map((item, i) => (
            <details key={i} style={{ marginBottom: 12 }}>
              <summary style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: 'var(--c-surface-container-high)',
                border: '1px solid rgba(74,68,81,0.20)',
                cursor: 'pointer', fontSize: 12, fontWeight: 600,
                color: 'var(--c-primary)', listStyle: 'none',
                fontFamily: 'var(--font-body)',
              }}>
                <span style={{ fontSize: 14, flexShrink: 0 }}>{item.title[lang as keyof typeof item.title] || item.title.en}</span>
              </summary>
              <div style={{ padding: '8px 0 0 24px', borderLeft: '2px solid rgba(189,147,249,0.25)', marginLeft: 4 }}>
                <p style={{ fontSize: 11, color: 'var(--c-on-surface-variant)', lineHeight: 1.5, margin: '0 0 8px' }}>
                  {item.desc[lang as keyof typeof item.desc] || item.desc.en}
                </p>
                {item.examples.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {item.examples.map((ex, ei) => (
                      <div key={ei} style={{
                        background: 'var(--c-surface-container)',
                        border: '1px solid rgba(74,68,81,0.20)',
                        borderRadius: 8, padding: '8px 10px',
                        fontSize: 11, fontFamily: 'monospace',
                        color: 'var(--c-on-surface)', lineHeight: 1.4,
                        whiteSpace: 'pre-wrap', overflowX: 'auto',
                      }}>
                        <span style={{ color: 'var(--c-outline)', fontSize: 10, textTransform: 'uppercase' }}>
                          {ex.lang.toUpperCase()}:&nbsp;
                        </span>
                        {ex.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          ))}
        </div>
      </details>
    );
  };

  return (
    <div style={{ padding: 16, maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        {STRINGS[lang]?.manualTitle || 'User Manual'}
      </p>
      {sections.map(renderSection)}
    </div>
  );
}

const LANG_OPTIONS: { key: Lang; label: string }[] = [
  { key: 'en', label: '🇬🇧 English' },
  { key: 'si', label: '🇱🇰 සිංහල'   },
  { key: 'sl', label: '🇱🇰 Sihalish' },
  { key: 'ta', label: '🇱🇰 தமிழ்'    },
  { key: 'tl', label: '🇱🇰 Tanglish' },
];

interface OrderEntry {
  order_id?: string;
  items: { id: string; name: string; price: number; image: string }[];
  date?: string;
  city?: string;
  recipient?: string;
}

function HistoryPanel({ lang }: { lang: Lang }) {
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [expanded, setExpanded] = useState<number | null>(0);

  useEffect(() => {
    try {
      // Try full history first, fall back to legacy last-order key
      const raw = localStorage.getItem('tara_order_history');
      if (raw) { setOrders(JSON.parse(raw)); return; }
      const legacy = localStorage.getItem('tara_last_order');
      if (legacy) setOrders([JSON.parse(legacy)]);
    } catch { /* */ }
  }, []);

  if (orders.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center' }}>
        <PackageIcon size={40} style={{ color: 'var(--c-outline)', margin: '0 auto 12px', display: 'block' }} />
        <p style={{ color: 'var(--c-on-surface-variant)', fontSize: 14 }}>No order history yet.</p>
        <p style={{ color: 'var(--c-outline)', fontSize: 12, marginTop: 4 }}>Your orders will appear here after checkout.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {orders.map((order, idx) => (
        <div key={idx} style={{ marginBottom: 10, background: 'var(--c-surface-container)', borderRadius: 12, border: '1px solid rgba(74,68,81,0.25)', overflow: 'hidden' }}>
          {/* Order header — always visible, click to expand */}
          <button onClick={() => setExpanded(expanded === idx ? null : idx)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
            <PackageIcon size={16} style={{ color: 'var(--c-primary)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-on-surface)', fontFamily: 'monospace', letterSpacing: '0.03em' }}>
                {order.order_id ?? '—'}
              </p>
              <p style={{ fontSize: 11, color: 'var(--c-outline)', marginTop: 1 }}>
                {order.date ? new Date(order.date).toLocaleDateString('en-LK', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                {order.city ? ` · ${order.city}` : ''}
                {order.recipient ? ` · ${order.recipient}` : ''}
              </p>
            </div>
            <span style={{ fontSize: 10, color: 'var(--c-outline)', transition: 'transform 0.15s', transform: expanded === idx ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block' }}>▶</span>
          </button>

          {/* Order items — shown when expanded */}
          {expanded === idx && (
            <div style={{ padding: '0 12px 12px' }}>
              {order.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8, marginBottom: 5, background: 'var(--c-surface-container-high)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: 'var(--c-surface-container)' }}>
                    {item.image && <img src={`/api/img?url=${encodeURIComponent(item.image)}`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-on-surface)', lineHeight: 1.3 }} className="line-clamp-2">{item.name}</p>
                    <p style={{ fontSize: 11, color: 'var(--c-secondary)', fontWeight: 700, marginTop: 2 }}>Rs. {item.price.toLocaleString('si-LK')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RewardsPanel() {
  return (
    <div style={{ padding: 24 }}>
      {/* Points card */}
      <div style={{
        borderRadius: 16, padding: '20px 24px', marginBottom: 16,
        background: 'linear-gradient(135deg, rgba(64,20,120,0.6), rgba(113,74,170,0.4))',
        border: '1px solid rgba(215,186,255,0.25)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--c-primary)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>TARA Points</p>
        <p style={{ fontSize: 42, fontWeight: 700, color: 'var(--c-on-surface)', fontFamily: 'var(--font-headline)', lineHeight: 1.1, margin: '8px 0 4px' }}>0</p>
        <p style={{ fontSize: 12, color: 'var(--c-on-surface-variant)' }}>Points earned on Kapruka orders</p>
      </div>
      {[
        { emoji: '🛍️', label: 'First order',          pts: '+50 pts',  done: false },
        { emoji: '⭐',  label: 'Rate a product',       pts: '+10 pts',  done: false },
        { emoji: '🌍',  label: 'Expat mode order',     pts: '+25 pts',  done: false },
        { emoji: '🎁',  label: 'Send a gift',          pts: '+15 pts',  done: false },
      ].map(r => (
        <div key={r.label} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px', borderRadius: 10, marginBottom: 6,
          background: r.done ? 'rgba(197,205,101,0.08)' : 'var(--c-surface-container)',
          border: `1px solid ${r.done ? 'rgba(197,205,101,0.25)' : 'rgba(74,68,81,0.25)'}`,
          opacity: r.done ? 1 : 0.7,
        }}>
          <span style={{ fontSize: 20 }}>{r.emoji}</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--c-on-surface)' }}>{r.label}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: r.done ? 'var(--c-secondary)' : 'var(--c-outline)' }}>{r.pts}</span>
        </div>
      ))}
      <p style={{ fontSize: 11, color: 'var(--c-outline)', textAlign: 'center', marginTop: 12 }}>Rewards program — coming soon</p>
    </div>
  );
}

/* ─── Types ────────────────────────────────────────────────────────────── */
type CatItem = {
  id:      string;
  name:    string;
  emoji:   string;
  query:   string;
  url?:    string;   // Kapruka page URL — present when MCP returned one
  parent?: string;   // set for level-2 items; absent for top-level
};

type L3Item = {
  name:  string;
  url:   string;
  emoji: string;
  query: string;
};

/* ─── Shared card button ────────────────────────────────────────────────── */
function CatBtn({
  emoji, name, onClick, showArrow = false, disabled = false,
}: {
  emoji: string; name: string; onClick: () => void;
  showArrow?: boolean; disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 12px', borderRadius: 10,
        cursor: disabled ? 'default' : 'pointer',
        background: 'var(--c-surface-container)',
        border: '1px solid rgba(74,68,81,0.25)',
        transition: 'all 0.15s ease', textAlign: 'left',
        opacity: disabled ? 0.5 : 1, width: '100%',
      }}
      onMouseOver={e => {
        if (!disabled) {
          e.currentTarget.style.background    = 'var(--c-surface-container-high)';
          e.currentTarget.style.borderColor   = 'rgba(215,186,255,0.30)';
        }
      }}
      onMouseOut={e => {
        e.currentTarget.style.background  = 'var(--c-surface-container)';
        e.currentTarget.style.borderColor = 'rgba(74,68,81,0.25)';
      }}
    >
      <span style={{ fontSize: 20, flexShrink: 0 }}>{emoji}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-on-surface)', lineHeight: 1.3, flex: 1 }}>
        {name}
      </span>
      {showArrow && (
        <ChevronRightIcon size={12} style={{ color: 'var(--c-outline)', flexShrink: 0 }} />
      )}
    </button>
  );
}

/* ─── Back button ───────────────────────────────────────────────────────── */
function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '3px 10px', borderRadius: 20,
        background: 'rgba(189,147,249,0.12)',
        border: '1px solid rgba(189,147,249,0.30)',
        color: 'var(--c-primary)', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'var(--font-body)', flexShrink: 0,
      }}
    >
      <ChevronRightIcon size={12} style={{ transform: 'rotate(180deg)' }} />
      Back
    </button>
  );
}

/* ─── Skeleton grid ─────────────────────────────────────────────────────── */
function SkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height: 48, borderRadius: 10 }} />
      ))}
    </div>
  );
}

/* ─── BrowsePanel — 3-level navigation ─────────────────────────────────── */
function BrowsePanel({ onCategorySearch, onClose }: { onCategorySearch: (q: string) => void; onClose: () => void }) {
  /* Level 1+2 from MCP */
  const [categories, setCategories] = useState<CatItem[]>([]);
  const [catLoading, setCatLoading] = useState(true);

  /* Drill-down state */
  const [selected,    setSelected]    = useState<CatItem | null>(null);
  const [selectedSub, setSelectedSub] = useState<CatItem | null>(null);
  const [level3,      setLevel3]      = useState<L3Item[]>([]);
  const [loadingL3,   setLoadingL3]   = useState(false);

  /* Search — only active on top-level view */
  const [search, setSearch] = useState('');

  /* Fetch level 1+2 on mount */
  useEffect(() => {
    fetch('/api/categories')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setCategories(
        Array.isArray(d.categories) && d.categories.length > 0 ? d.categories : FALLBACK_CATEGORIES
      ))
      .catch(() => setCategories(FALLBACK_CATEGORIES))
      .finally(() => setCatLoading(false));
  }, []);

  /* Derived lists */
  const topLevel  = categories.filter(c => !c.parent);
  const totalSubs = categories.filter(c => !!c.parent).length;
  const subItems  = selected ? categories.filter(c => c.parent === selected.name) : [];

  /* Search — across top-level AND subcategories */
  const q = search.trim().toLowerCase();
  const searchResults: (CatItem & { _isSub?: boolean })[] = q
    ? [
        /* Matching top-level categories */
        ...topLevel
          .filter(c => c.name.toLowerCase().includes(q))
          .map(c => ({ ...c, _isSub: false })),
        /* Matching subcategories (level-2) */
        ...categories
          .filter(c => !!c.parent && c.name.toLowerCase().includes(q))
          .map(c => ({ ...c, _isSub: true })),
      ]
    : [];

  /* ── Handlers ─────────────────────────────────────────────────────── */

  /* Clicking a top-level category */
  const handleTopClick = (cat: CatItem) => {
    const hasSubs = categories.some(c => c.parent === cat.name);
    if (hasSubs) {
      setSelected(cat);
      setSelectedSub(null);
      setLevel3([]);
    } else {
      onCategorySearch(cat.query);
      onClose();
    }
  };

  /* Clicking a level-2 subcategory — try to fetch level-3, else search */
  const handleSubClick = async (cat: CatItem) => {
    if (!cat.url) {
      onCategorySearch(cat.query);
      onClose();
      return;
    }

    setSelectedSub(cat);
    setLoadingL3(true);
    setLevel3([]);

    try {
      const res  = await fetch(`/api/categories?sub=${encodeURIComponent(cat.url)}`);
      const data = await res.json() as { subcategories?: L3Item[] };
      const subs = data.subcategories ?? [];

      if (subs.length > 0) {
        setLevel3(subs);
      } else {
        /* No level-3 exists — trigger search directly */
        onCategorySearch(cat.query);
        onClose();
      }
    } catch {
      onCategorySearch(cat.query);
      onClose();
    } finally {
      setLoadingL3(false);
    }
  };

  /* Clicking a level-3 sub-subcategory */
  const handleL3Click = (item: L3Item) => {
    onCategorySearch(item.query);
    onClose();
  };

  /* ── Breadcrumb / header ──────────────────────────────────────────── */
  const view: 'top' | 'l2' | 'l3' = level3.length > 0 || loadingL3 ? 'l3' : selected ? 'l2' : 'top';

  const handleBack = () => {
    if (view === 'l3') { setLevel3([]); setSelectedSub(null); }
    else               { setSelected(null); setSelectedSub(null); setLevel3([]); setSearch(''); }
  };

  /* ── Render ───────────────────────────────────────────────────────── */
  return (
    <div style={{ padding: 16 }}>

      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: view === 'top' ? 2 : 10 }}>
        {view !== 'top' && <BackBtn onClick={handleBack} />}
        <p style={{
          fontSize: 11, fontWeight: 700, color: 'var(--c-outline)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          margin: 0, flex: 1,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {catLoading
            ? 'Loading categories…'
            : view === 'l3' && selectedSub ? `${selectedSub.emoji} ${selectedSub.name}`
            : view === 'l2' && selected    ? `${selected.emoji} ${selected.name}`
            : `${topLevel.length} Kapruka Categories`}
        </p>
        {view === 'l2' && subItems.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-outline)', flexShrink: 0 }}>{subItems.length} items</span>
        )}
        {view === 'l3' && level3.length > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-outline)', flexShrink: 0 }}>{level3.length} items</span>
        )}
      </div>

      {/* ── Subcategory count subtitle — top view only ── */}
      {view === 'top' && !catLoading && (
        <p style={{
          fontSize: 10, color: 'var(--c-outline)', margin: '0 0 10px',
          letterSpacing: '0.04em', opacity: 0.75,
        }}>
          {totalSubs} subcategories across all categories
        </p>
      )}

      {/* ── Search bar — top view only ── */}
      {view === 'top' && !catLoading && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', borderRadius: 10, marginBottom: 12,
          background: 'var(--c-surface-container)',
          border: '1px solid rgba(74,68,81,0.35)',
        }}>
          {/* Search icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--c-outline)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search categories…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: 13, color: 'var(--c-on-surface)', fontFamily: 'var(--font-body)',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--c-outline)', padding: 0, lineHeight: 1,
                fontSize: 16, display: 'flex', alignItems: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* ── View: top-level loading skeleton ── */}
      {catLoading && <SkeletonGrid count={8} />}

      {/* ── View: top-level categories (L1) or search results ── */}
      {!catLoading && view === 'top' && (
        q ? (
          /* ── Search results: single-column with parent labels ── */
          searchResults.length === 0
            ? (
              <p style={{ fontSize: 13, color: 'var(--c-outline)', textAlign: 'center', padding: '24px 0' }}>
                No results for &ldquo;{search}&rdquo;
              </p>
            ) : (
              <>
                <p style={{ fontSize: 10, color: 'var(--c-outline)', marginBottom: 8, opacity: 0.75 }}>
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {searchResults.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => cat._isSub ? handleSubClick(cat) : handleTopClick(cat)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                        background: 'var(--c-surface-container)',
                        border: '1px solid rgba(74,68,81,0.25)',
                        transition: 'all 0.15s ease', textAlign: 'left', width: '100%',
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background   = 'var(--c-surface-container-high)';
                        e.currentTarget.style.borderColor  = 'rgba(215,186,255,0.30)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background  = 'var(--c-surface-container)';
                        e.currentTarget.style.borderColor = 'rgba(74,68,81,0.25)';
                      }}
                    >
                      <span style={{ fontSize: 20, flexShrink: 0 }}>{cat.emoji}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{
                          display: 'block', fontSize: 13, fontWeight: 600,
                          color: 'var(--c-on-surface)', lineHeight: 1.3,
                        }}>
                          {cat.name}
                        </span>
                        {cat._isSub && cat.parent && (
                          <span style={{
                            display: 'block', fontSize: 10, color: 'var(--c-outline)',
                            marginTop: 2, opacity: 0.8,
                          }}>
                            in {cat.parent}
                          </span>
                        )}
                      </span>
                      {!cat._isSub && categories.some(c => c.parent === cat.name) && (
                        <ChevronRightIcon size={12} style={{ color: 'var(--c-outline)', flexShrink: 0 }} />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )
        ) : (
          /* ── Normal 2-column grid ── */
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {topLevel.map(cat => (
              <CatBtn
                key={cat.id}
                emoji={cat.emoji}
                name={cat.name}
                onClick={() => handleTopClick(cat)}
                showArrow={categories.some(c => c.parent === cat.name)}
              />
            ))}
          </div>
        )
      )}

      {/* ── View: level-2 subcategories ── */}
      {!catLoading && view === 'l2' && selected && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CatBtn
            key="__all__"
            emoji={selected.emoji}
            name={`All ${selected.name}`}
            onClick={() => { onCategorySearch(selected.query); onClose(); }}
          />
          {subItems.map(sub => (
            <CatBtn
              key={sub.id}
              emoji={sub.emoji}
              name={sub.name}
              onClick={() => handleSubClick(sub)}
              showArrow={!!sub.url}
            />
          ))}
        </div>
      )}

      {/* ── View: level-3 loading skeleton ── */}
      {loadingL3 && (
        <>
          <p style={{ fontSize: 11, color: 'var(--c-outline)', marginBottom: 8 }}>Fetching subcategories…</p>
          <SkeletonGrid count={6} />
        </>
      )}

      {/* ── View: level-3 scraped sub-subcategories ── */}
      {!loadingL3 && view === 'l3' && selectedSub && level3.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CatBtn
            key="__all_sub__"
            emoji={selectedSub.emoji}
            name={`All ${selectedSub.name}`}
            onClick={() => { onCategorySearch(selectedSub.query); onClose(); }}
          />
          {level3.map((item, i) => (
            <CatBtn
              key={i}
              emoji={item.emoji}
              name={item.name}
              onClick={() => handleL3Click(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SettingsPanel({ lang, onLangChange, onClearChat, onClose }: { lang: Lang; onLangChange: (l: Lang) => void; onClearChat: () => void; onClose: () => void }) {
  const [cleared, setCleared] = useState(false);
  return (
    <div style={{ padding: 16 }}>
      {/* Language */}
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Language</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
        {LANG_OPTIONS.map(o => (
          <button
            key={o.key}
            onClick={() => onLangChange(o.key)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
              background: lang === o.key ? 'rgba(189,147,249,0.15)' : 'var(--c-surface-container)',
              border: `1px solid ${lang === o.key ? 'rgba(189,147,249,0.40)' : 'rgba(74,68,81,0.25)'}`,
              color: lang === o.key ? 'var(--c-primary)' : 'var(--c-on-surface-variant)',
              fontWeight: lang === o.key ? 700 : 500, fontSize: 14,
              transition: 'all 0.15s',
              fontFamily: 'var(--font-body)',
            }}
          >
            {o.label}
            {lang === o.key && <span style={{ fontSize: 12, color: 'var(--c-primary-container)' }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Chat actions */}
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Chat</p>
      <button
        onClick={() => { onClearChat(); setCleared(true); onClose(); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '10px 14px', borderRadius: 10, cursor: 'pointer',
          background: cleared ? 'rgba(197,205,101,0.10)' : 'var(--c-surface-container)',
          border: '1px solid rgba(74,68,81,0.25)',
          color: cleared ? 'var(--c-secondary)' : 'var(--c-on-surface-variant)',
          fontSize: 14, fontWeight: 500, transition: 'all 0.15s',
          fontFamily: 'var(--font-body)',
        }}
      >
        <TrashIcon size={16} />
        {cleared ? 'Chat cleared!' : 'Clear chat history'}
      </button>

      {/* About */}
      <div style={{ marginTop: 20, padding: '12px 14px', borderRadius: 10, background: 'var(--c-surface-container)', border: '1px solid rgba(74,68,81,0.25)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-on-surface)', marginBottom: 4 }}>TARA v1.0</p>
        <p style={{ fontSize: 11, color: 'var(--c-outline)' }}>AI Retail Agent · Kapruka Agent Challenge · Built with Next.js 16 · Powered by Gemini</p>
      </div>
    </div>
  );
}

function HelpPanel() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Frequently Asked Questions
      </p>
      {FAQS.map((faq, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <button
            onClick={() => setOpen(open === i ? null : i)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
              width: '100%', padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
              background: open === i ? 'rgba(189,147,249,0.12)' : 'var(--c-surface-container)',
              border: `1px solid ${open === i ? 'rgba(189,147,249,0.30)' : 'rgba(74,68,81,0.25)'}`,
              color: 'var(--c-on-surface)', fontSize: 13, fontWeight: 600,
              textAlign: 'left', transition: 'all 0.15s',
              fontFamily: 'var(--font-body)',
            }}
          >
            <span>{faq.q}</span>
            <ChevronRightIcon size={14} style={{ transform: open === i ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0, color: 'var(--c-outline)' }} />
          </button>
          {open === i && (
            <div style={{ padding: '10px 14px', background: 'rgba(34,28,49,0.60)', borderRadius: '0 0 10px 10px', margin: '-4px 0 0', border: '1px solid rgba(74,68,81,0.20)', borderTop: 'none' }}>
              <p style={{ fontSize: 13, color: 'var(--c-on-surface-variant)', lineHeight: 1.6 }}>{faq.a}</p>
            </div>
          )}
        </div>
      ))}
      <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(197,205,101,0.08)', border: '1px solid rgba(197,205,101,0.20)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--c-secondary)', fontWeight: 700, marginBottom: 4 }}>Still need help?</p>
        <p style={{ fontSize: 12, color: 'var(--c-on-surface-variant)' }}>Type your question in the chat — TARA will help you!</p>
      </div>
    </div>
  );
}

/* ─── Menu row — used by the mobile "Menu" directory panel ─────────────── */
function MenuRow({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        width: '100%', padding: '12px 14px', borderRadius: 12, marginBottom: 6,
        cursor: 'pointer', textAlign: 'left',
        background: 'var(--c-surface-container)',
        border: '1px solid rgba(74,68,81,0.25)',
        color: 'var(--c-on-surface)', fontSize: 14, fontWeight: 600,
        transition: 'all 0.15s', fontFamily: 'var(--font-body)',
      }}
      onMouseOver={e => { e.currentTarget.style.background = 'var(--c-surface-container-high)'; e.currentTarget.style.borderColor = 'rgba(215,186,255,0.30)'; }}
      onMouseOut={e => { e.currentTarget.style.background = 'var(--c-surface-container)'; e.currentTarget.style.borderColor = 'rgba(74,68,81,0.25)'; }}
    >
      <span style={{ color: 'var(--c-primary)', flexShrink: 0, display: 'flex' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <ChevronRightIcon size={14} style={{ color: 'var(--c-outline)', flexShrink: 0 }} />
    </button>
  );
}

/* ─── Menu panel — mobile-only directory to everything the desktop
   sidebar exposes (History, Rewards, Browse, Settings, Help, Notifications)
   plus the voice toggle that has no other home on small screens ────────── */
function MenuPanel({ onNavigate, speakerOn, onSpeakerToggle }: {
  onNavigate: (panel: Exclude<PanelId, 'none' | 'menu'>) => void;
  speakerOn: boolean;
  onSpeakerToggle: () => void;
}) {
  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Explore
      </p>
      <MenuRow icon={<PackageIcon  size={18} />} label="Order History"     onClick={() => onNavigate('history')} />
      <MenuRow icon={<RewardsIcon  size={18} />} label="Rewards"           onClick={() => onNavigate('rewards')} />
      <MenuRow icon={<BrowseIcon   size={18} />} label="Browse Categories" onClick={() => onNavigate('browse')} />
      <MenuRow icon={<PackageSearchIcon size={18} />} label="Track Order"        onClick={() => onNavigate('track')} />
      <MenuRow icon={<BellIcon     size={18} />} label="Notifications"     onClick={() => onNavigate('notifications')} />

      <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-outline)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '18px 0 10px' }}>
        Support
      </p>
      <MenuRow icon={<SettingsIcon size={18} />} label="Settings"   onClick={() => onNavigate('settings')} />
      <MenuRow icon={<HelpIcon     size={18} />} label="Help & FAQ" onClick={() => onNavigate('help')} />
      <MenuRow icon={<span style={{fontSize:18}}>📖</span>} label="User Manual"       onClick={() => onNavigate('manual')} />

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid rgba(74,68,81,0.25)' }}>
        <button
          onClick={onSpeakerToggle}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%',
            padding: '12px 14px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: speakerOn ? 'rgba(189,147,249,0.12)' : 'var(--c-surface-container)',
            border: `1px solid ${speakerOn ? 'rgba(189,147,249,0.30)' : 'rgba(74,68,81,0.25)'}`,
            color: 'var(--c-on-surface)', fontSize: 14, fontWeight: 600,
            fontFamily: 'var(--font-body)',
          }}
        >
          <span style={{ fontSize: 18, flexShrink: 0 }}>{speakerOn ? '🔊' : '🔇'}</span>
          <span style={{ flex: 1 }}>TARA voice replies</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: speakerOn ? 'var(--c-primary)' : 'var(--c-outline)' }}>
            {speakerOn ? 'On' : 'Off'}
          </span>
        </button>
      </div>
    </div>
  );
}

/* ─── Track Order panel ─────────────────────────────────────────────────── */
function TrackPanel() {
  const [orderNumber, setOrderNumber] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [result,      setResult]      = useState<null | {
    status?: string | null;
    error?:  string | null;
    recipient?: string;
    deliveryDate?: string;
    items?: { name: string; quantity: number }[];
  }>(null);

  const handleTrack = async () => {
    const num = orderNumber.trim();
    if (!num) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: num }),
      });
      const data = await r.json();
      setResult({
        status: data.status ?? null,
        error:  data.error ?? null,
      });
    } catch {
      setResult({ error: 'Could not reach tracking service. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <p style={{ fontSize: 13, color: 'var(--c-on-surface-variant)', marginBottom: 14 }}>
        Enter your Kapruka order number to check its status.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={orderNumber}
          onChange={e => setOrderNumber(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleTrack(); }}
          placeholder="e.g. VIMP34456CB2"
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 10,
            background: 'var(--c-surface-container)',
            border: '1px solid rgba(74,68,81,0.30)',
            color: 'var(--c-on-surface)', fontSize: 14,
            fontFamily: 'var(--font-body)', outline: 'none',
          }}
        />
        <button
          onClick={handleTrack}
          disabled={loading || !orderNumber.trim()}
          style={{
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: loading || !orderNumber.trim() ? 'rgba(64,41,112,0.15)' : 'var(--c-primary-container)',
            border: 'none',
            color: loading || !orderNumber.trim() ? 'var(--c-outline)' : 'var(--c-on-primary-container)',
            cursor: loading || !orderNumber.trim() ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
          }}
        >
          {loading ? '⏳' : 'Track →'}
        </button>
      </div>

      {/* Result */}
      {result && (
        <div style={{
          borderRadius: 12, padding: 16,
          background: 'var(--c-surface-container)',
          border: '1px solid rgba(215,186,255,0.14)',
        }}>
          {result.error ? (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#f87171', marginBottom: 4 }}>⚠️ Tracking Error</p>
              <p style={{ fontSize: 13, color: 'var(--c-on-surface-variant)' }}>{result.error}</p>
            </>
          ) : result.status ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-on-surface-variant)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Order Status</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-secondary)' }}>{result.status}</p>
              <p style={{ fontSize: 12, color: 'var(--c-on-surface-variant)', marginTop: 8 }}>
                Order: <span style={{ fontFamily: 'monospace', color: 'var(--c-on-surface)' }}>{orderNumber.trim()}</span>
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-on-surface)', marginBottom: 4 }}>No status found</p>
              <p style={{ fontSize: 13, color: 'var(--c-on-surface-variant)' }}>
                Could not find tracking info for <span style={{ fontFamily: 'monospace' }}>{orderNumber.trim()}</span>. Please check the order number and try again.
              </p>
            </>
          )}
        </div>
      )}

      {/* Tip */}
      <div style={{
        marginTop: 20, padding: 14, borderRadius: 10,
        background: 'rgba(215,186,255,0.06)',
        border: '1px solid rgba(215,186,255,0.12)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--c-on-surface-variant)', lineHeight: 1.5 }}>
          💡 Your order number is in the confirmation email from Kapruka after payment. It looks like <span style={{ fontFamily: 'monospace', color: 'var(--c-on-surface)' }}>VIMP34456CB2</span>.
        </p>
      </div>
    </div>
  );
}

const PANEL_META: Record<Exclude<PanelId,'none'>, { title: string; icon: React.ReactNode }> = {
  history:       { title: 'Order History',   icon: <PackageIcon  size={18} /> },
  rewards:       { title: 'Rewards',          icon: <RewardsIcon  size={18} /> },
  browse:        { title: 'Browse Categories',icon: <BrowseIcon   size={18} /> },
  track:         { title: 'Track Order',       icon: <PackageSearchIcon size={18} /> },
  settings:      { title: 'Settings',         icon: <SettingsIcon size={18} /> },
  help:          { title: 'Help & FAQ',        icon: <HelpIcon     size={18} /> },
  notifications: { title: 'Notifications',    icon: <BellIcon     size={18} /> },
  menu:          { title: 'Menu',              icon: <MenuIcon     size={18} /> },
  manual:        { title: 'User Manual',       icon: <span style={{fontSize:18}}>📖</span> },
};
import { BellIcon, MenuIcon } from './Icons';

export default function SidePanel({ panel, lang, onClose, onCategorySearch, onLangChange, onClearChat, onNavigate, speakerOn, onSpeakerToggle }: SidePanelProps) {
  const visible = panel !== 'none';

  return (
    <>
      {/* Backdrop */}
      {visible && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 45,
            background: 'rgba(16,11,31,0.60)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed',
        top: 64, right: 0, bottom: 0,
        width: Math.min(340, typeof window !== 'undefined' ? window.innerWidth - 16 : 340),
        zIndex: 46,
        display: 'flex', flexDirection: 'column',
        background: 'rgba(29,24,45,0.96)',
        backdropFilter: 'blur(20px)',
        borderLeft: '1px solid rgba(74,68,81,0.30)',
        transform: visible ? 'translateX(0)' : 'translateX(110%)',
        transition: 'transform 0.30s cubic-bezier(0.32,0.72,0,1)',
      }}>
        {/* Header */}
        {visible && (
          <>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '14px 16px',
              borderBottom: '1px solid rgba(74,68,81,0.25)',
              flexShrink: 0,
            }}>
              <span style={{ color: 'var(--c-primary)' }}>{PANEL_META[panel].icon}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-on-surface)', flex: 1, fontFamily: 'var(--font-headline)' }}>
                {PANEL_META[panel].title}
              </span>
              <button onClick={onClose} style={{ color: 'var(--c-outline)', cursor: 'pointer', background: 'none', border: 'none', padding: 4 }}>
                <XIcon size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {panel === 'history'       && <HistoryPanel lang={lang} />}
              {panel === 'rewards'       && <RewardsPanel />}
              {panel === 'browse'        && <BrowsePanel onCategorySearch={onCategorySearch} onClose={onClose} />}
              {panel === 'settings'      && <SettingsPanel lang={lang} onLangChange={onLangChange} onClearChat={onClearChat} onClose={onClose} />}
              {panel === 'help'          && <HelpPanel />}
              {panel === 'track'         && <TrackPanel />}
              {panel === 'menu'          && <MenuPanel onNavigate={onNavigate} speakerOn={speakerOn} onSpeakerToggle={onSpeakerToggle} />}
              {panel === 'manual'        && <UserManualPanel lang={lang} />}
              {panel === 'notifications' && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                  <BellIcon size={40} style={{ color: 'var(--c-outline)', margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ color: 'var(--c-on-surface-variant)', fontSize: 14 }}>No notifications yet.</p>
                  <p style={{ color: 'var(--c-outline)', fontSize: 12, marginTop: 4 }}>Order updates will appear here.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}