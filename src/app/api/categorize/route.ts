import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import Fuse from 'fuse.js';
import nlp from 'compromise';
import countriesLib from 'i18n-iso-countries';
import 'i18n-iso-countries/langs/en.json';

const keywordCategories = {
  sales: [
    'sale', 'discount', 'offer', 'quote', 'order', 'purchase', 'deal', 'transaction', 'rfq', 'bid', 'pricing', 'estimate', 'proposal', 'invoice', 'contract', 'agreement', 'customer', 'client', 'lead', 'prospect', 'opportunity', 'sales order', 'purchase order', 'po', 'buy', 'sell', 'selling', 'sold', 'buying', 'payment terms', 'fulfillment', 'shipment', 'delivery', 'supply', 'demand', 'stock', 'inventory', 'product', 'goods', 'item', 'catalog', 'price list', 'commission', 'wholesale', 'retail', 'distribution', 'reseller', 'channel partner', 'freight quote', 'freight rate', 'rate request', 'spot rate', 'rfq', 'tender', 'shipment booking', 'booking request', 'cargo sale', 'charter', 'chartering', 'space allocation', 'allocation', 'container sale', 'container lease', 'lease', 'demurrage', 'detention', 'free time', 'transit time', 'transshipment', 'routing', 'routing order', 'routing guide', 'routing instruction', 'shipping instruction', 'shipping order', 'so', 'bill of lading', 'bol', 'awb', 'air waybill', 'sea waybill', 'delivery order', 'do', 'cargo release', 'release order', 'release note', 'cargo manifest', 'manifest', 'packing list', 'commercial invoice', 'proforma invoice', 'customs invoice', 'export declaration', 'import declaration', 'customs clearance', 'clearance', 'brokerage', 'customs broker', 'forwarder', 'freight forwarder', 'nvocc', 'ocean carrier', 'airline', 'trucking', 'haulage', 'drayage', 'cartage', 'last mile', 'first mile', 'cross-dock', 'cross docking', 'consolidation', 'deconsolidation', 'groupage', 'fcl', 'lcl', 'ftl', 'ltl', 'door to door', 'port to port', 'cfs', 'icd', 'bonded', 'bonded warehouse', 'warehouse receipt', 'cargo insurance', 'marine insurance', 'cargo claim', 'damage claim', 'loss claim', 'freight collect', 'freight prepaid', 'incoterms', 'exw', 'fob', 'cif', 'dap', 'ddp', 'cfr', 'cpt', 'cip', 'dat', 'dpu', 'ddu', 'eori', 'hs code', 'tariff', 'duty', 'vat', 'gst', 'importer', 'exporter', 'consignee', 'shipper', 'notify party', 'agent', 'liner', 'carrier', 'vessel', 'voyage', 'eta', 'etd', 'ata', 'atd', 'cut-off', 'closing', 'sailing', 'arrival', 'departure', 'rollover', 'roll over', 'blank sailing', 'omission', 'omitted port', 'no show', 'cargo ready', 'cargo available', 'cargo pickup', 'cargo delivery', 'pickup order', 'delivery order', 'pod', 'proof of delivery', 'milestone', 'tracking', 'trace', 'tracing', 'shipment status', 'shipment update', 'shipment delay', 'delay notice', 'delay', 'exception', 'disruption', 'force majeure', 'strike', 'congestion', 'port congestion', 'customs hold', 'inspection', 'quarantine', 'fumigation', 'certificate', 'phyto', 'sanitary', 'vgm', 'verified gross mass', 'weighing', 'tare', 'gross weight', 'net weight', 'cbm', 'cubic meter', 'volume', 'dimension', 'measurement', 'oversize', 'overweight', 'hazardous', 'dangerous goods', 'imo', 'msds', 'un number', 'class', 'packing group', 'temperature control', 'reefer', 'refrigerated', 'cold chain', 'iso tank', 'flexitank', 'project cargo', 'breakbulk', 'ro-ro', 'roll-on roll-off', 'heavy lift', 'out of gauge', 'oog', 'flat rack', 'open top', 'container type', 'container size', '20gp', '40gp', '40hq', '45hc', 'hc', 'high cube', 'dry van', 'reefer container', 'special equipment', 'equipment request', 'equipment release', 'empty return', 'empty pickup', 'chassis', 'genset', 'seal', 'seal number', 'container number', 'booking number', 'reference number', 'tracking number', 'waybill number', 'cargo number', 'shipment number', 'order number', 'invoice number', 'reference', 'reference code', 'reference id', 'reference no', 'reference #'
  ],
  marketing: [
    'campaign', 'ad', 'promotion', 'advertising', 'media', 'social media', 'newsletter', 'branding', 'brand', 'event', 'webinar', 'conference', 'expo', 'trade show', 'press release', 'publicity', 'seo', 'sem', 'content', 'blog', 'influencer', 'sponsorship', 'market research', 'survey', 'focus group', 'lead generation', 'outreach', 'email blast', 'marketing strategy', 'digital marketing', 'creative', 'design', 'graphics', 'video', 'commercial', 'announcement', 'launch', 'rollout', 'awareness', 'engagement', 'audience', 'target market', 'demographic', 'analytics', 'insight', 'trend', 'growth', 'brand ambassador', 'logistics event', 'logistics expo', 'transportation conference', 'shipping seminar', 'supply chain summit', 'freight webinar', 'forwarder meetup', 'carrier event', 'port open day', 'warehouse tour', 'demo day', 'product launch', 'service launch', 'case study', 'white paper', 'industry report', 'market update', 'logistics award', 'supply chain award', 'best practice', 'customer story', 'testimonial', 'success story', 'logistics influencer', 'supply chain influencer', 'thought leader', 'thought leadership', 'industry insight', 'market trend', 'logistics trend', 'supply chain trend', 'freight trend', 'shipping trend', 'port news', 'carrier news', 'forwarder news', 'logistics news', 'newsletter', 'logistics blog', 'supply chain blog', 'freight blog', 'shipping blog', 'case competition', 'student challenge', 'hackathon', 'innovation challenge', 'logistics innovation', 'supply chain innovation', 'digitalization', 'digital logistics', 'smart logistics', 'smart supply chain', 'automation', 'robotics', 'ai', 'machine learning', 'blockchain', 'iot', 'telematics', 'tracking app', 'tracking platform', 'visibility platform', 'control tower', 'supply chain visibility', 'real-time tracking', 'real time tracking', 'live tracking', 'shipment tracking', 'container tracking', 'cargo tracking', 'order tracking', 'delivery tracking', 'milestone update', 'status update', 'shipment update', 'logistics update', 'supply chain update', 'freight update', 'shipping update', 'port update', 'carrier update', 'forwarder update', 'newsletter signup', 'newsletter subscription', 'newsletter offer', 'newsletter campaign', 'newsletter promotion', 'newsletter event', 'newsletter news', 'newsletter insight', 'newsletter trend', 'newsletter story', 'newsletter case', 'newsletter report', 'newsletter award', 'newsletter launch', 'newsletter update', 'newsletter feedback', 'newsletter survey', 'newsletter photo', 'newsletter gallery', 'newsletter video', 'newsletter recording', 'newsletter stream', 'newsletter broadcast', 'newsletter live', 'newsletter virtual', 'newsletter in-person', 'newsletter hybrid'
  ],
  accounting: [
    'invoice', 'payment', 'receipt', 'bill', 'statement', 'balance', 'account', 'accounts payable', 'accounts receivable', 'ap', 'ar', 'ledger', 'reconciliation', 'audit', 'tax', 'vat', 'gst', 'withholding', 'remittance', 'bank', 'wire', 'transfer', 'swift', 'iban', 'accounting', 'bookkeeping', 'expense', 'reimbursement', 'payroll', 'salary', 'wage', 'compensation', 'fee', 'charge', 'cost', 'budget', 'forecast', 'financial', 'finance', 'profit', 'loss', 'p&l', 'cash flow', 'statement', 'credit', 'debit', 'overdue', 'collection', 'reminder', 'settlement', 'clearing', 'deposit', 'withdrawal', 'transaction', 'fiscal', 'quarter', 'year end', 'closing', 'report', 'reporting', 'freight invoice', 'freight bill', 'shipping invoice', 'shipping bill', 'ocean freight invoice', 'air freight invoice', 'trucking invoice', 'customs invoice', 'customs bill', 'duty invoice', 'duty bill', 'vat invoice', 'vat bill', 'gst invoice', 'gst bill', 'demurrage invoice', 'detention invoice', 'storage invoice', 'storage bill', 'handling invoice', 'handling bill', 'terminal invoice', 'terminal bill', 'port invoice', 'port bill', 'agency invoice', 'agency bill', 'commission invoice', 'commission bill', 'brokerage invoice', 'brokerage bill', 'forwarder invoice', 'forwarder bill', 'carrier invoice', 'carrier bill', 'liner invoice', 'liner bill', 'nvocc invoice', 'nvocc bill', 'freight collect', 'freight prepaid', 'collect charge', 'prepaid charge', 'collect payment', 'prepaid payment', 'collect fee', 'prepaid fee', 'collect cost', 'prepaid cost', 'collect amount', 'prepaid amount', 'collect invoice', 'prepaid invoice', 'collect bill', 'prepaid bill', 'collect receipt', 'prepaid receipt', 'collect statement', 'prepaid statement', 'collect balance', 'prepaid balance', 'collect account', 'prepaid account', 'collect ledger', 'prepaid ledger', 'collect reconciliation', 'prepaid reconciliation', 'collect audit', 'prepaid audit', 'collect tax', 'prepaid tax', 'collect vat', 'prepaid vat', 'collect gst', 'prepaid gst', 'collect duty', 'prepaid duty', 'collect remittance', 'prepaid remittance', 'collect bank', 'prepaid bank', 'collect wire', 'prepaid wire', 'collect transfer', 'prepaid transfer', 'collect swift', 'prepaid swift', 'collect iban', 'prepaid iban', 'collect accounting', 'prepaid accounting', 'collect bookkeeping', 'prepaid bookkeeping', 'collect expense', 'prepaid expense', 'collect reimbursement', 'prepaid reimbursement', 'collect payroll', 'prepaid payroll', 'collect salary', 'prepaid salary', 'collect wage', 'prepaid wage', 'collect compensation', 'prepaid compensation', 'collect fee', 'prepaid fee', 'collect charge', 'prepaid charge', 'collect cost', 'prepaid cost', 'collect budget', 'prepaid budget', 'collect forecast', 'prepaid forecast', 'collect financial', 'prepaid financial', 'collect finance', 'prepaid finance', 'collect profit', 'prepaid profit', 'collect loss', 'prepaid loss', 'collect p&l', 'prepaid p&l', 'collect cash flow', 'prepaid cash flow', 'collect statement', 'prepaid statement', 'collect credit', 'prepaid credit', 'collect debit', 'prepaid debit', 'collect overdue', 'prepaid overdue', 'collect collection', 'prepaid collection', 'collect reminder', 'prepaid reminder', 'collect settlement', 'prepaid settlement', 'collect clearing', 'prepaid clearing', 'collect deposit', 'prepaid deposit', 'collect withdrawal', 'prepaid withdrawal', 'collect transaction', 'prepaid transaction', 'collect fiscal', 'prepaid fiscal', 'collect quarter', 'prepaid quarter', 'collect year end', 'prepaid year end', 'collect closing', 'prepaid closing', 'collect report', 'prepaid report', 'collect reporting', 'prepaid reporting'
  ],
  partnership: [
    'partner', 'collaboration', 'affiliate', 'alliance', 'joint venture', 'cooperation', 'synergy', 'partnership', 'strategic partner', 'business partner', 'teaming', 'consortium', 'association', 'network', 'franchise', 'licensing', 'license', 'distribution agreement', 'mou', 'memorandum of understanding', 'nda', 'non-disclosure', 'agreement', 'co-branding', 'integration', 'ecosystem', 'partnership proposal', 'partnership opportunity', 'partnership request', 'partnership inquiry', 'partnership offer', 'partnership agreement', 'logistics partner', 'shipping partner', 'supply chain partner', 'freight partner', 'carrier partner', 'forwarder partner', 'nvocc partner', 'trucking partner', 'customs partner', 'broker partner', 'warehouse partner', 'distribution partner', 'technology partner', 'integration partner', 'platform partner', 'port partner', 'terminal partner', 'agency partner', 'agent partner', 'liner partner', 'association partner', 'network partner', 'franchise partner', 'licensing partner', 'cooperation partner', 'synergy partner', 'strategic partner', 'business partner', 'teaming partner', 'consortium partner', 'alliance partner', 'joint venture partner', 'collaboration partner', 'affiliate partner', 'ecosystem partner', 'co-branding partner', 'co-marketing partner', 'co-selling partner', 'co-development partner', 'co-innovation partner', 'co-investment partner', 'co-funding partner', 'co-financing partner', 'co-ownership partner', 'co-management partner', 'co-operation partner', 'co-creation partner', 'co-design partner', 'co-production partner', 'co-distribution partner', 'co-logistics partner', 'co-shipping partner', 'co-supply chain partner', 'co-freight partner', 'co-carrier partner', 'co-forwarder partner', 'co-nvocc partner', 'co-trucking partner', 'co-customs partner', 'co-broker partner', 'co-warehouse partner', 'co-distribution partner', 'co-technology partner', 'co-integration partner', 'co-platform partner', 'co-port partner', 'co-terminal partner', 'co-agency partner', 'co-agent partner', 'co-liner partner', 'co-association partner', 'co-network partner', 'co-franchise partner', 'co-licensing partner', 'co-cooperation partner', 'co-synergy partner', 'co-strategic partner', 'co-business partner', 'co-teaming partner', 'co-consortium partner', 'co-alliance partner', 'co-joint venture partner', 'co-collaboration partner', 'co-affiliate partner', 'co-ecosystem partner'
  ],
  investment: [
    'invest', 'funding', 'capital', 'seed', 'venture', 'angel', 'series a', 'series b', 'series c', 'private equity', 'ipo', 'stock', 'share', 'equity', 'valuation', 'investor', 'investment', 'fund', 'financing', 'crowdfunding', 'pitch', 'business plan', 'return', 'roi', 'exit', 'acquisition', 'merger', 'buyout', 'due diligence', 'term sheet', 'convertible note', 'safe', 'syndicate', 'portfolio', 'asset', 'liability', 'debt', 'loan', 'grant', 'subsidy', 'dividend', 'interest', 'yield', 'capital gain', 'liquidity', 'round', 'raise', 'seed round', 'pre-seed', 'bridge round', 'follow-on', 'lead investor', 'co-investor', 'lp', 'gp', 'limited partner', 'general partner', 'logistics investment', 'shipping investment', 'supply chain investment', 'freight investment', 'carrier investment', 'forwarder investment', 'nvocc investment', 'trucking investment', 'customs investment', 'broker investment', 'warehouse investment', 'distribution investment', 'technology investment', 'integration investment', 'platform investment', 'port investment', 'terminal investment', 'agency investment', 'agent investment', 'liner investment', 'association investment', 'network investment', 'franchise investment', 'licensing investment', 'cooperation investment', 'synergy investment', 'strategic investment', 'business investment', 'teaming investment', 'consortium investment', 'alliance investment', 'joint venture investment', 'collaboration investment', 'affiliate investment', 'ecosystem investment', 'co-branding investment', 'co-marketing investment', 'co-selling investment', 'co-development investment', 'co-innovation investment', 'co-investment', 'co-funding investment', 'co-financing investment', 'co-ownership investment', 'co-management investment', 'co-operation investment', 'co-creation investment', 'co-design investment', 'co-production investment', 'co-distribution investment', 'co-logistics investment', 'co-shipping investment', 'co-supply chain investment', 'co-freight investment', 'co-carrier investment', 'co-forwarder investment', 'co-nvocc investment', 'co-trucking investment', 'co-customs investment', 'co-broker investment', 'co-warehouse investment', 'co-distribution investment', 'co-technology investment', 'co-integration investment', 'co-platform investment', 'co-port investment', 'co-terminal investment', 'co-agency investment', 'co-agent investment', 'co-liner investment', 'co-association investment', 'co-network investment', 'co-franchise investment', 'co-licensing investment', 'co-cooperation investment', 'co-synergy investment', 'co-strategic investment', 'co-business investment', 'co-teaming investment', 'co-consortium investment', 'co-alliance investment', 'co-joint venture investment', 'co-collaboration investment', 'co-affiliate investment', 'co-ecosystem investment'
  ],
  events: [
    'event', 'webinar', 'conference', 'expo', 'summit', 'meetup', 'workshop', 'seminar', 'training', 'bootcamp', 'hackathon', 'competition', 'award', 'ceremony', 'gala', 'networking', 'session', 'panel', 'talk', 'presentation', 'keynote', 'exhibition', 'showcase', 'fair', 'festival', 'opening', 'launch', 'celebration', 'party', 'gathering', 'reception', 'banquet', 'symposium', 'forum', 'roundtable', 'retreat', 'outing', 'trip', 'tour', 'site visit', 'open house', 'registration', 'invitation', 'rsvp', 'agenda', 'schedule', 'program', 'speaker', 'sponsor', 'sponsorship', 'exhibitor', 'attendee', 'guest', 'host', 'organizer', 'venue', 'location', 'ticket', 'pass', 'badge', 'booth', 'stand', 'display', 'demo', 'presentation', 'announcement', 'reminder', 'update', 'follow-up', 'thank you', 'feedback', 'survey', 'photo', 'gallery', 'video', 'recording', 'stream', 'broadcast', 'live', 'virtual', 'in-person', 'hybrid', 'logistics event', 'shipping event', 'supply chain event', 'freight event', 'carrier event', 'forwarder event', 'nvocc event', 'trucking event', 'customs event', 'broker event', 'warehouse event', 'distribution event', 'technology event', 'integration event', 'platform event', 'port event', 'terminal event', 'agency event', 'agent event', 'liner event', 'association event', 'network event', 'franchise event', 'licensing event', 'cooperation event', 'synergy event', 'strategic event', 'business event', 'teaming event', 'consortium event', 'alliance event', 'joint venture event', 'collaboration event', 'affiliate event', 'ecosystem event', 'co-branding event', 'co-marketing event', 'co-selling event', 'co-development event', 'co-innovation event', 'co-investment event', 'co-funding event', 'co-financing event', 'co-ownership event', 'co-management event', 'co-operation event', 'co-creation event', 'co-design event', 'co-production event', 'co-distribution event', 'co-logistics event', 'co-shipping event', 'co-supply chain event', 'co-freight event', 'co-carrier event', 'co-forwarder event', 'co-nvocc event', 'co-trucking event', 'co-customs event', 'co-broker event', 'co-warehouse event', 'co-distribution event', 'co-technology event', 'co-integration event', 'co-platform event', 'co-port event', 'co-terminal event', 'co-agency event', 'co-agent event', 'co-liner event', 'co-association event', 'co-network event', 'co-franchise event', 'co-licensing event', 'co-cooperation event', 'co-synergy event', 'co-strategic event', 'co-business event', 'co-teaming event', 'co-consortium event', 'co-alliance event', 'co-joint venture event', 'co-collaboration event', 'co-affiliate event', 'co-ecosystem event'
  ]
};

// Get all country names in English
const countries = Object.values(countriesLib.getNames('en'));

// Fuzzy match utility (stricter, only accept matches above a score threshold)
function fuzzyMatch(text: string, choices: string[], threshold = 0.8, minScore = 0.5): string[] {
  const fuse = new Fuse(choices, { includeScore: true, threshold });
  const results = fuse.search(text);
  // Only accept matches with a score below minScore (lower score = better match)
  return results.filter(r => r.score !== undefined && r.score <= minScore).map(r => r.item);
}

// Updated detection for categories (no semantic)
async function detectCategoriesAdvanced(subject: string, body: string): Promise<string[]> {
  const text = `${subject} ${body}`;
  // 1. Compromise (keyword)
  const compromiseFound = legacyDetectCategories(subject, body);
  if (compromiseFound.length > 0) return compromiseFound;
  // 2. Fuzzy
  const allCategories = Object.keys(keywordCategories);
  const fuzzy = fuzzyMatch(text, allCategories);
  return fuzzy;
}

// Helper: check if a word is present as a whole word in text
function containsWholeWord(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, 'i').test(text);
}

// Updated detection for countries (no semantic, only whole word matches)
async function detectCountriesAdvanced(text: string): Promise<string[]> {
  // 1. Compromise (filter to whole word matches only)
  const compromise = legacyDetectCountriesCompromise(text).filter(country => containsWholeWord(text, country));
  if (compromise.length > 0) return compromise;
  // 2. Fuzzy (stricter, only whole word matches)
  const fuzzyCandidates = fuzzyMatch(text, countries, 0.4, 0.25);
  const fuzzy = fuzzyCandidates.filter(country => containsWholeWord(text, country));
  return fuzzy;
}

// Utility to strip HTML tags from a string
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ');
}

interface PostRequestBody {
  inquiryId: string;
}

// Move categorize logic to a function so it can be called directly
export async function categorizeInquiry(inquiryId: string): Promise<{ success: boolean; categories: string[]; countries: string[]; error?: string }> {
  const supabase = await createClient();
  const { data: inquiry, error } = await supabase
    .from('inquiries')
    .select('id, subject, body')
    .eq('id', inquiryId)
    .single();

  if (error || !inquiry) {
    return { success: false, categories: [], countries: [], error: 'Inquiry not found' };
  }

  // Strip HTML from body before detection
  const plainBody = stripHtml(inquiry.body);
  // Advanced detection
  const categories = await detectCategoriesAdvanced(inquiry.subject, plainBody);
  const countryTags = await detectCountriesAdvanced(`${inquiry.subject} ${plainBody}`);

  // Upsert categories
  const categoryInsert = categories.map(category => ({
    inquiry_id: inquiry.id,
    category,
  }));
  if (categoryInsert.length > 0) {
    const { error: catError } = await supabase
      .from('inquiry_categories')
      .upsert(categoryInsert, { onConflict: 'inquiry_id,category' });
    if (catError) {
      console.error('Failed to upsert categories:', catError);
      return { success: false, categories, countries: countryTags, error: 'Failed to upsert categories' };
    }
  } else {
    console.log('No categories to upsert for inquiry:', inquiry.id);
  }

  // Upsert countries
  const countryInsert = countryTags.map(country => ({
    inquiry_id: inquiry.id,
    country,
  }));
  if (countryInsert.length > 0) {
    const { error: countryError } = await supabase
      .from('inquiry_countries')
      .upsert(countryInsert, { onConflict: 'inquiry_id,country' });
    if (countryError) {
      console.error('Failed to upsert countries:', countryError);
      return { success: false, categories, countries: countryTags, error: 'Failed to upsert countries' };
    }
  } else {
    console.log('No countries to upsert for inquiry:', inquiry.id);
  }

  return { success: true, categories, countries: countryTags };
}

export async function POST(request: Request): Promise<Response> {
  const { inquiryId }: PostRequestBody = await request.json();
  const result = await categorizeInquiry(inquiryId);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, categories: result.categories, countries: result.countries });
}

// Rename old functions for clarity
const legacyDetectCategories = function(subject: string, body: string): string[] {
  const matches = new Set<string>();
  const text = `${subject} ${body}`.toLowerCase();
  for (const [category, keywords] of Object.entries(keywordCategories)) {
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        matches.add(category);
        break;
      }
    }
  }
  return [...matches];
};

// nlp is imported above
const legacyDetectCountriesCompromise = function(text: string): string[] {
  const doc = nlp(text);
  const found = doc.places().out('array');
  const lowered = text.toLowerCase();
  return countries.filter(country => lowered.includes(country.toLowerCase()) || found.includes(country));
};
