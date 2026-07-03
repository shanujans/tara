import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/security';

export const dynamic = 'force-dynamic';

const MAX_B64 = 2.5 * 1024 * 1024;

const LOG = {
  info:  (...a: unknown[]) => console.log('[TARA:VISION]', ...a),
  warn:  (...a: unknown[]) => console.warn('[TARA:VISION] ⚠️', ...a),
  error: (...a: unknown[]) => console.error('[TARA:VISION] ❌', ...a),
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!rateLimit(ip, 20, 60_000))
    return NextResponse.json({ error: 'Rate limited' }, { status: 429 });

  const { imageBase64, mimeType } = await req.json();
  if (!imageBase64 || !mimeType)
    return NextResponse.json({ error: 'Missing image' }, { status: 400 });
  if (imageBase64.length > MAX_B64)
    return NextResponse.json({ error: 'Image too large (max 2 MB)' }, { status: 413 });

  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!ALLOWED_TYPES.includes(mimeType))
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 415 });

  LOG.info('incoming image', { mimeType, b64Length: imageBase64.length });

  /* Lazy-init client — avoids module-level credential error at build time */
  const { GoogleGenAI } = await import('@google/genai');
  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY ?? '',
  });

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.1-flash-lite',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType, data: imageBase64 } },
          { text: `You are a product-search assistant for Kapruka, a Sri Lankan e-commerce platform.
Identify the main product in this image.

Valid categories and their valid subcategories (choose subcategory ONLY from the array under the chosen category; leave it as an empty string if nothing fits):
{
  "automobile": [audio_and_video_accessories, auto_care, automobile_electronics, automobile_gift_pack, batteries, bike_jackets, engine_oils_and_lubricants, helmet, hybrid_auto_care, modifications_accessories, motor_parts_accessories, motorbike_accessories, tires_and_wheels, tools_and_equipment, vehicle_service_packages],
  "ayurvedic": [balm, other, pills],
  "bicycles": [bike_helmets_and_accessories, bike_tires_and_tubes, cruiser_bicycles, electric_bicycles, folding_bicycles, hybrid_bicycles, kids_bicycles, kids_electric_vehicles, kids_push_rideons, kids_scooters, kids_tricycles, mountain_bicycles, off_road_bicycles, skateboards, special_bicycle_deal],
  "books": [academic_-and-_reference, architecture_and_design, art_design_and_photography, biography, cd_and_dvd, children\`s_book, comics_and_graphic, computers_and_technology, cookery, education_and_textbooks, enviornment, fiction_and_literature, general_knowledge, health_and_lifestyle, history_and_social_science, hobbies_and_crafts, home_-and-_garden, music_and_entertainment, non_fiction, novel, offers, preschool, reference, religion_-and-_beliefs, self_help_and_personal_development, translations, travel_-and-_leisure, young_and_adult, magazine],
  "chocolates": [5_star_hotels, anods_cocoa, bounty_chocolate, bueno, cadbury, chocolate_hampers, ferrero_rocher, gerard_mendis_chocolatier, godiva, gummies, hersheys, home_made_confectioneries, java, kandos, kapruka_chocolates, kitkat, lindt, m_n_m\`s, mars, milka, nestle, revello, ritzbury, snickers, sweet_buds, toblerone, twix, zellers, royal_french_chocolates],
  "clothing": [kids_clothing, mens_clothing, saree, saree_blouse, sportswear, unisex_clothing, women_activewear, womens_clothing, clothing_gift_sets, mens_activewear],
  "combogifts": [cake_and_flower, choco_gift, choco_gift_and_cake, chocolate_and_fashion, chocolate_and_teddy_and_flower, clothing_and_flower, electronic_gifts_and_teddy, gift_set_and_cake, gift_set_and_flower, gift_set_and_teddy, kids_combo_gift, teddy_and_flower, clothing_and_chocolates, clothing_and_fashion, flower_and_fashion, fruits_and_flower],
  "cosmetics": [beauty_tools_and_accessories, body_care, gift_sets, hair_care, makeup, men\`s_grooming, nail_care, skin_care, sun_protection, janet, luvesence],
  "curd": [],
  "electronics": [audio_and_home_entertainment, batteries_and_chargers, cables_and_connecters, cameras_and_photography, computers_and_accessories, diy_and_hobby_electronics, gaming, home_appliances, kitchen_appliances, light_and_power, mobile_phone_accessories, mobile_phones, networking_devices, personal_care, smart_home, storage_and_memory, tablets_and_accessories, tools_and_machinery, wearable_technology, accessories_and_gadgets],
  "fashion": [belts, eyewear_accessories, gents_shoes, handbags_and_travel_accessories, headwear, kids_accessories, kids_shoes, ladies_shoes, men\`s_accessories, umbrellas, unisex_shoes, women\`s_accessories, fashion_gift_sets],
  "fruitbaskets": [basket, common, fruit_basket, fruits, seasonal],
  "giftvouchers": [apparel_shops, book_stores, hotels_and_restaurants, household, jewellery, medical, phone_cards, salons_and_spas, special_occasions, super_markets, tickets, tours],
  "giftset": [gift_sets_for_couples, gift_sets_for_dad, gift_sets_for_her, gift_sets_for_him, gift_sets_for_kids, gift_sets_for_mom],
  "greetingcards": [newborn_cards, seasonal_cards, sympathy_and_condolence, thank_you_cards, wedding_cards, birthday_cards, anniversary_cards, graduation_cards, friendship_and_thinking_of_you_cards, love_and_romance_cards, congratulations_cards, funny_cards, get_well_soon_cards, naughty_cards, miss_you_cards, i_am_sorry_cards],
  "grocery": [seafood, frozen_food, baby_food_and_nutrition, bagged_food, bakery-and-spreads-and-cereals, beverages, canned_food, cleansers, condiments, confectionery_and_biscuits, dairy_products, dessert, eggs_and_oil, flour_-and-_instant_mixes, global_food, juice_-and-_drinks, liquor, non_alcoholic_wine, organic-and-homemade_products, pasta_and_noodles, pest_control, rice, snacks_and_sweets, special_offers, specialty_foods, spices_and_seasoning, tobacco, wellness],
  "home_lifestyle": [bathware, bedroom, cleaning_tools_and_accessories, electrical_solutions, fire_crackers, foldable_home_appliances, furniture, gardening, home_decor_and_accessories, housewarming_gift_sets, kitchen_and_dining, laundry_and_cleaning, mugs, plants_and_gardening, porcelain, sewing_machines, tools_-and-_diy_-and-_outdoor, wall_art_and_decor, screw_you, entertainment],
  "jewellery": [alankara_diamond_jewelry, arthur_jewelry_shop, chamathka, gold_jewelry, kids_fashion_jewelry, mallika_hemachandra, men\`s_jewelry, raja_jewelers, ravi_jewelers, stone_n_string, swarna_mahal, tash_gem_and_jewelry, vogue_jewelers, watches, women\`s_jewelry],
  "toys": [action_figures_and_playsets, arts_and_crafts, board_games_and_puzzles, building_blocks_and_lego_sets, dolls_and_dollhouses, educational_and_learning_toys, hot_wheels_and_toy_vehicles, musical_instruments_for_kids, outdoor_toys, puppets, remote_cars, role_playing_and_dress_up_playsets, toy_bundles, die_cast_model_cars],
  "liquor": [beer, champaign_and_vodka, gift_set, local_liquor, whisky_and_brandy, wine],
  "baby": [baby_gear, baby_gift_packs, bath_and_hygiene, clothing_and_apparel, diapering_and_baby_care, feeding_accessories, feeding_and_nursing, food_and_nutrition, health_and_wellness_for_moms, maternity_products, nursery_furniture_and_decor, potty_training, safety_and_health, toys_and_entertainment, travel_and_on_the_go, baby_care_accessories],
  "party": [costumes_and_accessories, decorations, party_favours, party_tableware, supplies],
  "perfumes": [kid\`s_perfume, men\`s_perfumes, unisex_perfumes, women\`s_perfumes],
  "pet": [food_and_treats, live_pets, pet_accessories, pet_health_and_grooming, training_aids],
  "pharmacy": [adult_care_and_orthopedic, adult_toys, ayurveda_products, bone_and_joint_pain, capsules, cleaning_products, health_and_beauty, healthy_bundle, measurement_products, medical_care_and_aid, medicine, mom_and_baby_care, personal_care, pill_containers_and_accessories, sexual_wellness, surgical_accessories, vitamins_and_supplements, women_care],
  "pirikara": [pirikara, religious_audio_and_video, religious_decor, religious_figures, religious_gifts_and_offerings, worship_items],
  "childrens": [arts_and_crafts_supplies, bags, book_list, educational_activity_tools, kids_stationary_gift_set, school_essentials, stationary, whiteboard_and_blackboard, collectibles, gift_stationery],
  "schoolpride": [ananda_college, general_merchandise, lyceum, nalanda_college, royal_college, stafford_international, trinity_college, visakha],
  "softtoy": [cartoon_characters, dolls, fantasy_creatures, plush_animals, plush_pillows, teddy_bunch],
  "sports": [adventure, board_games, fitness_equipments, individual_sports, martial_arts, team_sports, water_sports],
  "vegetables": [cut_vegetables, dehydrated_vegetables, exotic_vegetables, fresh_vegetables, herbs, leafy_vegetables, organic_vegetables, packaged_vegetables],
  "intimate_essentials": [vibrators, dildos, male_pleasure_toys, anal_toys, bdsm_and_kink, fetish, erotic_accessories, essentials_and_gifts, intimate_apparel_and_accessories, maintenance_and_care],
  "cakes": [kapruka_cakes, java, divine, gerard_mendis_chocolatier, bread_talk, t-lounge_by_dilmah, colombo_hilton, cinnamon_grand, kingsbury, cinnamon_lakeside, green_cabin, topaz_kandy, sponge, nh_collection_colombo, mahaweli_reach_kandy, galadari, ramada, waters_edge, shangri-la, caravan_fresh, courtyard_by_marriott, customized_cakes, amari_colombo, mount_lavinia_hotel, kandy_myst_by_cinnamon, earl\`s_regent_hotel],
  "flowers": [shirohana, plants, flower_bouquets, love_and_romance, birthday_flowers, anniversary_flowers, just, congratulation_flowers, wedding_flowers, sympathy, thank_you, getwell_flowers, newborn_flowers, exotic_flowers, custom_flowers, wholesale],
  "personalized_gifts": [personalized_drinkware, personalized_apparel, personalized_accessories, personalized_home_and_living, personalized_stationery, personalized_jewelry, personalized_chocolates, personalized_gift_boxes, personalized_hampers, personalized_message_in_a_bottle, personalized_greeting_cards, personalized_tech_gifts, personalized_figurines],
  "services": [photography, home_and_lifestyle_services, health_and_wellness_services, educational_and_tutoring_services, automotive_services, event_and_party_services, courier_and_logistics, beauty_and_grooming_services, business_and_professional_services, travel_and_transport_services, pet_services, legal_and_doc, tech_and_digital_services, learning_and_personal_growth, cultural_and_religious_services, astrology, donation, newspaper_delivery],
  "food": []
}

Respond ONLY with valid JSON (no markdown, no backticks):
{"query":"<2–5 word search query for Kapruka>","description":"<one-sentence description>","category":"<one of the top-level keys above>","subcategory":"<the closest value from that category's array, or an empty string if none fit>"}` },
        ],
      }],
      config: {
        maxOutputTokens: 1000,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            description: { type: 'string' },
            category: { type: 'string' },
            subcategory: { type: 'string' },
          },
          required: ['query', 'description', 'category', 'subcategory'],
        },
      },
    });

    const raw = response.text ?? '{}';
    LOG.info('finish_reason:', response.candidates?.[0]?.finishReason, '| usage:', response.usageMetadata);
    LOG.info('raw model output:', raw);

    const clean = raw.replace(/```json|```/g, '').trim();
    let parsed: { query: string; description: string; category: string; subcategory: string };
    try {
      parsed = JSON.parse(clean);
      LOG.info('parsed via JSON.parse OK:', parsed);
    } catch {
      LOG.warn('JSON.parse failed, falling back to regex extraction. clean=', clean);
      const qm = clean.match(/"query"\s*:\s*"([^"]+)"/);
      const dm = clean.match(/"description"\s*:\s*"([^"]+)"/);
      const cm = clean.match(/"category"\s*:\s*"([^"]+)"/);
      const sm = clean.match(/"subcategory"\s*:\s*"([^"]*)"/);
      parsed = {
        query: qm?.[1] ?? 'gift',
        description: dm?.[1] ?? raw.slice(0, 80),
        category: cm?.[1] ?? 'other',
        subcategory: sm?.[1] ?? '',
      };
      LOG.warn('regex fallback result:', parsed);
    }

    const result = {
      query: parsed.query || 'gift',
      description: parsed.description || '',
      category: parsed.category || 'other',
      subcategory: parsed.subcategory || '',
    };
    LOG.info('final response:', result);
    return NextResponse.json(result);
  } catch (err) {
    LOG.error('vision-search error:', err);
    return NextResponse.json({ error: 'Vision analysis failed' }, { status: 500 });
  }
}