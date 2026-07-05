# TARA Mistakes Log

Issues reported by users via 👎 feedback.
Use this file to debug and improve TARA responses over time.

---

## Issue #1 — Jun 30, 2026, 12:15 AM

**Category:** No upsell
**Language:** EN

**User reported:**
> (no description provided)

**TARA response that triggered this:**
> Father's Day is this month 👨 — want to send something special to your thaththa?

**Conversation context (last 2 messages):**
  > **TARA:** Hey! I'm TARA. Groceries, electronics, fashion, or sending something special — what do you need today?
  > **TARA:** Father's Day is this month 👨 — want to send something special to your thaththa?

---

## Issue #2 — Jul 1, 2026, 11:07 AM

**Category:** Other
**Language:** EN

**User reported:**
> No products returned.

**TARA response that triggered this:**
> Great choice! Kapruka delivers to Colombo 7 tomorrow 📦 — here are some Samsung phones for Priya!

**Conversation context (last 4 messages):**
  > **User:** Send to Priya in Colombo 7, her phone is 0771234567, deliver tomorrow
  > **TARA:** Got it! I've filled in the details — just open your cart to review and place the order 🛒

What would you like to send to Priya? 🎁
  > **User:** samsung phone
  > **TARA:** Great choice! Kapruka delivers to Colombo 7 tomorrow 📦 — here are some Samsung phones for Priya!

---

## Issue #3 — Jul 4, 2026, 12:59 PM

**Category:** No upsell
**Language:** EN

**User reported:**
> (no description provided)

**TARA response that triggered this:**
> Let me analyze this message carefully.
> 
> The user wants:
> 1. A laptop under LKR 500,000
> 2. Delivery details:
>    - Recipient: John
>    - Date: "tomorrow on 07/06/2026" - Today is 2026-07-04. Let me resolve this date conflict.
>      - "tomorrow" = 2026-07-05
>      - "07/06/2026" - DD/MM/YYYY = June 7, 2026 = PAST ❌
>      - MM/DD/YYYY = July 6, 2026 = FUTURE ✅
>      - So explicit date 07/06/2026 as MM/DD = July 6, 2026 → use 2026-07-06
>      - "tomorrow" = July 5 vs explicit "July 6" → prefer explicit date → 2026-07-06
>    - Address: No. 45, Gregory's Road
>    - City: Colombo 07
>    - Location type: House /

**Conversation context (last 3 messages):**
  > **TARA:** Hey! I'm TARA — your personal shopping agent for Kapruka 🛍️ Whether you're hunting for the perfect gift, sending love to family back home, or need something fast — just tell me what you're after!
  > **User:** laptop under 500k Deliver john tomorrow on 07/06/2026 to No. 45, Gregory's Road, Colombo 07. Location type is House / Residence, and occasion is Just Because. shggfty@gmail.com, p.no is 0771456789, my shanu
  > **TARA:** Let me analyze this message carefully.

The user wants:
1. A laptop under LKR 500,000
2. Delivery details:
   - Recipient: John
   - Date: "tomorrow on 07/06/2026" - Today is 2026-07-04. Let me resolve this date conflict.
     - "tomorrow" = 2026-07-05
     - "07/06/2026" - DD/MM/YYYY = June 7, 2026…

---

## Issue #4 — Jul 4, 2026, 3:25 PM

**Category:** No upsell
**Language:** SL

**User reported:**
> (no description provided)

**TARA response that triggered this:**
> On it! Searching for laptops under LKR 500,000 and saving John's delivery details for the 6th of July 🛒

**Conversation context (last 4 messages):**
  > **TARA:** Hey! I'm TARA — your personal shopping agent for Kapruka 🛍️ Whether you're hunting for the perfect gift, sending love to family back home, or need something fast — just tell me what you're after!
  > **TARA:** Happy Esala Season! 🪔 As the Perahera festivities begin, let's get you ready for the long holiday weekend. I can track down the best deals on modest white temple wear, travel essentials, and festive gift bundles available right now on Kapruka.
  > **User:** Mata 500k walata adu laptop ekak order karanna oni. Meka 07/06/2026 wenida John ta deliver karanna No. 45, Gregory's Road, Colombo 07 (House/Residence) address ekata. Occasion eka 'Just Because'. Sender details: Shanu, email: shggfty@gmail.com, phone: 0771456789.
  > **TARA:** On it! Searching for laptops under LKR 500,000 and saving John's delivery details for the 6th of July 🛒

---

## Issue #5 — Jul 5, 2026, 4:32 PM

**Category:** Wrong products
**Language:** TA

**User reported:**
> (no description provided)

**TARA response that triggered this:**
> நிச்சயமாக, உங்கள் பேட்மின்டன் விளையாட்டுக்கு ஏற்ற சிறந்த இன்டோர் ஷூக்களை நான் தேடித் தருகிறேன்! 🏸 விளையாடும்போது நண்பர்களுடனும் நேரத்தை செலவிட இது நல்ல வாய்ப்பு, இந்த ஜூலை மாதம் நட்பு தினத்தை முன்னிட்டு உங்கள் விளையாட்டு நண்பர்களுக்கு ஏதேனும் பரிசுகள் வழங்க வேண்டுமா? 😊

**Conversation context (last 4 messages):**
  > **TARA:** Hey! I'm TARA — your personal shopping agent for Kapruka 🛍️ Whether you're hunting for the perfect gift, sending love to family back home, or need something fast — just tell me what you're after!
  > **TARA:** Happy Esala Season! 🪔 As the Perahera festivities begin, let's get you ready for the long holiday weekend. I can track down the best deals on modest white temple wear, travel essentials, and festive gift bundles available right now on Kapruka.
  > **User:** எனக்கு ஒரு இன்டோர் ஷூ வேணும். எப்படி எனா நான் மார்க்கிங் ஷூ வேணும். பேட்மின்டன் விளையாட போறதுக்கு. சோ பாத்து ரிசர்ச் பண்ணி ஒரு ₹10,000க்குள்ள பாத்து எடுத்தாங்களே.
  > **TARA:** நிச்சயமாக, உங்கள் பேட்மின்டன் விளையாட்டுக்கு ஏற்ற சிறந்த இன்டோர் ஷூக்களை நான் தேடித் தருகிறேன்! 🏸 விளையாடும்போது நண்பர்களுடனும் நேரத்தை செலவிட இது நல்ல வாய்ப்பு, இந்த ஜூலை மாதம் நட்பு தினத்தை முன்னிட்டு உங்கள் விளையாட்டு நண்பர்களுக்கு ஏதேனும் பரிசுகள் வழங்க வேண்டுமா? 😊

---

## Issue #6 — Jul 5, 2026, 9:12 PM

**Category:** Wrong products
**Language:** TA

**User reported:**
> (no description provided)

**TARA response that triggered this:**
> நிச்சயமாக, எங்களது சேகரிப்பில் இருக்கும் ஐபோன் மாடல்களைப் பார்க்கலாம் 😊 நண்பர்கள் தினத்தை (ஜூலை 30) முன்னிட்டு, இந்த மாதம் பரிசுகள் வழங்க மிகச்சிறந்த நேரம், எனவே உங்களுக்காக ஒரு நல்ல ஐபோனைத் தேர்ந்தெடுக்கிறேன்!

**Conversation context (last 4 messages):**
  > **User:** நான் கிரவுண்டில் ஜாகிங் போகும்போது தண்ணீர் விடாய்க்கும். அதனால் தண்ணீர் குடிப்பதுலே கஷ்டமாக இருக்கிறது. அதனால் தண்ணீர் எடுத்து போக ஒரு தண்ணீர் பாட்டில் இருந்தால் நன்றாக இருக்கும்.
  > **TARA:** ஜாகிங் செல்லும் போது உடன் தண்ணீர் பாட்டில் வைத்திருப்பது மிகவும் நல்லது 😊 இதோ உங்களுக்காக சில சிறந்த தண்ணீர் பாட்டில்கள்:
  > **User:** iPhone 1,00,000க்கு உள் வாங்க முடியுமா?
  > **TARA:** நிச்சயமாக, எங்களது சேகரிப்பில் இருக்கும் ஐபோன் மாடல்களைப் பார்க்கலாம் 😊 நண்பர்கள் தினத்தை (ஜூலை 30) முன்னிட்டு, இந்த மாதம் பரிசுகள் வழங்க மிகச்சிறந்த நேரம், எனவே உங்களுக்காக ஒரு நல்ல ஐபோனைத் தேர்ந்தெடுக்கிறேன்!

---
