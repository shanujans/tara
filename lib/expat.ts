export const EXPAT_TRIGGERS = /\b(uk|england|australia|canada|usa|america|dubai|qatar|singapore|germany|france|italy|abroad|overseas|foreign|london|sydney|toronto|new york|melbourne|doha|riyadh|kuwait|bahrain|oman)\b/i;

export function detectExpat(text: string): boolean {
  return EXPAT_TRIGGERS.test(text);
}

export const EXPAT_COUNTRIES: Record<string, string> = {
  uk: '🇬🇧 UK', england: '🇬🇧 UK', london: '🇬🇧 UK',
  australia: '🇦🇺 Australia', sydney: '🇦🇺 Australia', melbourne: '🇦🇺 Australia',
  canada: '🇨🇦 Canada', toronto: '🇨🇦 Canada',
  usa: '🇺🇸 USA', america: '🇺🇸 USA', 'new york': '🇺🇸 USA',
  dubai: '🇦🇪 Dubai', qatar: '🇶🇦 Qatar', doha: '🇶🇦 Qatar',
  singapore: '🇸🇬 Singapore',
  germany: '🇩🇪 Germany',
  riyadh: '🇸🇦 Saudi Arabia', kuwait: '🇰🇼 Kuwait',
  bahrain: '🇧🇭 Bahrain', oman: '🇴🇲 Oman',
  abroad: '🌍 Overseas', overseas: '🌍 Overseas', foreign: '🌍 Overseas',
};

export function detectExpatCountry(text: string): string {
  const lower = text.toLowerCase();
  for (const [key, val] of Object.entries(EXPAT_COUNTRIES)) {
    if (lower.includes(key)) return val;
  }
  return '🌍 Overseas';
}