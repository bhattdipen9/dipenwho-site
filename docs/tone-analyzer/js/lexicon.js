/*
 * ER Sentiment Lexicon
 * --------------------
 * Hand-written, equity-research-specific lexicon. You own this file — edit weights freely.
 *
 * Three layers, matched in this order (a token used by one layer is not reused by the next):
 *   1. PHRASES          fixed multi-word expressions with explicit weights
 *   2. METRICS x MOVES  "gross margin ... compressed", "raising ... guidance", "churn ... increased"
 *   3. WORDS            single finance words (starter list; replaced by Loughran-McDonald if loaded)
 *
 * Weights: roughly -5 (near-terminal) to +3 (strong positive). A single word is worth 1.
 */
(function (root) {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. ER PHRASES  [phrase, weight]
  // Matching is case-insensitive and lightly stemmed, so "raised"/"raising"/"raise"
  // all match, and plurals match singulars. Hyphens are treated as spaces.
  // ---------------------------------------------------------------------------
  const PHRASES = {
    // ---- Cash flow & profitability -----------------------------------------
    cash: [
      ['free cash flow positive', 3],
      ['cash flow positive', 2.5],
      ['ebitda positive', 2.5],
      ['operating income positive', 2.5],
      ['reached profitability', 3],
      ['achieved profitability', 3],
      ['path to profitability', 1],
      ['profitable growth', 2],
      ['operating leverage', 2],
      ['self funding', 1.5],
      ['cash generative', 2],
      ['strong cash generation', 2.5],
      ['negative free cash flow', -2.5],
      ['free cash flow negative', -2.5],
      ['cash flow negative', -2.5],
      ['net loss widened', -2.5],
    ],

    // ---- Balance sheet & liquidity ------------------------------------------
    liquidity: [
      ['strong balance sheet', 2],
      ['fortress balance sheet', 2.5],
      ['ample liquidity', 2],
      ['sufficient liquidity', 1],
      ['net cash position', 1.5],
      ['investment grade', 1.5],
      ['deleveraging', 1.5],
      ['paid down debt', 1.5],
      ['debt reduction', 1.5],
      ['credit rating upgrade', 2],
      ['liquidity crunch', -3.5],
      ['liquidity crisis', -4],
      ['liquidity constraints', -3],
      ['liquidity concerns', -3],
      ['tight liquidity', -2.5],
      ['going concern', -5],
      ['substantial doubt', -4.5],
      ['covenant waiver', -3],
      ['covenant amendment', -2.5],
      ['covenant breach', -4],
      ['covenant violation', -4],
      ['event of default', -4.5],
      ['missed interest payment', -4.5],
      ['credit rating downgrade', -2.5],
      ['negative outlook', -2],
      ['refinancing risk', -2],
      ['highly leveraged', -2],
      ['distressed', -3],
      ['chapter 11', -5],
      ['bankruptcy protection', -5],
      ['dilutive equity raise', -2],
      ['at the market offering', -1],
    ],

    // ---- Guidance & expectations --------------------------------------------
    guidance: [
      ['exceeded expectations', 2.5],
      ['ahead of expectations', 2.5],
      ['above expectations', 2.5],
      ['above the high end', 2.5],
      ['exceeded the high end', 2.5],
      ['above consensus', 2],
      ['beat and raise', 3],
      ['below expectations', -2.5],
      ['below the low end', -2.5],
      ['fell short', -2],
      ['short of expectations', -2.5],
      ['below consensus', -2],
      ['withdrawing guidance', -3.5],
      ['withdrew guidance', -3.5],
      ['suspending guidance', -3.5],
      ['reaffirm guidance', 0.5],
      ['reaffirming guidance', 0.5],
      ['reiterate guidance', 0.5],
      ['reiterating our guidance', 0.5],
    ],

    // ---- Demand, growth & competitive position ------------------------------
    demand: [
      ['record revenue', 2.5],
      ['record quarter', 2],
      ['record year', 2],
      ['record backlog', 2.5],
      ['record bookings', 2.5],
      ['record orders', 2.5],
      ['all time high', 2],
      ['accelerating growth', 2.5],
      ['growth accelerated', 2.5],
      ['double digit growth', 2],
      ['broad based strength', 2],
      ['broad based demand', 2],
      ['market share gains', 2],
      ['gained share', 2],
      ['taking share', 2],
      ['pricing power', 2],
      ['price increases stuck', 2],
      ['sold out', 1.5],
      ['capacity constrained', 1],
      ['demand exceeds supply', 2],
      ['healthy pipeline', 1.5],
      ['robust pipeline', 2],
      ['strong pipeline', 2],
      ['new logos', 1],
      ['multi year contract', 1],
      ['inflection point', 1.5],
      ['tailwinds', 1.5],
      ['secular tailwinds', 2],
      ['well positioned', 0.5],
      ['elongated sales cycles', -2],
      ['lengthening sales cycles', -2],
      ['longer sales cycles', -2],
      ['extended sales cycles', -2],
      ['deal slippage', -2],
      ['deals slipped', -2],
      ['pushed out', -1.5],
      ['budget scrutiny', -1.5],
      ['customer losses', -2],
      ['loss of a key customer', -3],
      ['loss of a major customer', -3],
      ['customer concentration', -1],
      ['lost share', -2],
      ['losing share', -2],
      ['share loss', -2],
      ['pricing pressure', -2],
      ['competitive pressure', -1.5],
      ['competitive intensity', -1],
      ['promotional environment', -1.5],
      ['softer demand', -2],
      ['demand softness', -2],
      ['soft demand', -2],
      ['weaker demand', -2],
      ['delayed orders', -2],
      ['order cancellations', -2.5],
      ['order delays', -2],
      ['destocking', -2],
      ['inventory digestion', -1.5],
      ['excess inventory', -2],
      ['inventory build', -1],
    ],

    // ---- Macro & operating environment -------------------------------------
    macro: [
      ['macro headwinds', -1.5],
      ['macroeconomic headwinds', -1.5],
      ['fx headwinds', -1],
      ['currency headwinds', -1],
      ['challenging environment', -1.5],
      ['challenging macro', -1.5],
      ['difficult environment', -1.5],
      ['uncertain environment', -1.5],
      ['uncertain macroeconomic environment', -1.5],
      ['supply chain disruptions', -1.5],
      ['supply constraints', -1],
      ['input cost inflation', -1.5],
      ['cost inflation', -1],
      ['wage inflation', -1],
      ['favorable mix', 1.5],
      ['unfavorable mix', -1.5],
    ],

    // ---- Restructuring, accounting & legal ----------------------------------
    events: [
      ['goodwill impairment', -2.5],
      ['impairment charge', -2],
      ['asset write down', -2],
      ['inventory write down', -2],
      ['write off', -2],
      ['restructuring charges', -1.5],
      ['restructuring plan', -1.5],
      ['workforce reduction', -1.5],
      ['reduction in force', -1.5],
      ['headcount reduction', -1.5],
      ['plant closure', -1.5],
      ['strategic alternatives', -1],
      ['material weakness', -4],
      ['restatement', -4],
      ['restate', -3.5],
      ['sec investigation', -3],
      ['doj investigation', -3],
      ['subpoena', -2],
      ['class action', -2],
      ['delisting', -4],
      ['auditor resignation', -4],
      ['ceo departure', -1.5],
      ['cfo departure', -2],
      ['share repurchase', 1],
      ['buyback', 1],
      ['special dividend', 1.5],
      ['accretive acquisition', 1.5],
    ],
  };

  // ---------------------------------------------------------------------------
  // 2. METRICS x MOVES
  // A metric paired with a direction word within WINDOW tokens (same sentence).
  //   polarity +1  -> going up is good   (revenue, margin, backlog)
  //   polarity -1  -> going up is bad    (churn, leverage, DSO, costs)
  //   weight       -> base size of the signal
  // ---------------------------------------------------------------------------
  const METRICS = [
    // good when up
    ['guidance', 1, 3], ['outlook', 1, 2.5], ['forecast', 1, 2],
    ['revenue', 1, 1.5], ['revenues', 1, 1.5], ['sales', 1, 1.5], ['top line', 1, 1.5],
    ['same store sales', 1, 2], ['comparable sales', 1, 2], ['organic growth', 1, 2],
    ['gross margin', 1, 2], ['operating margin', 1, 2], ['ebitda margin', 1, 2],
    ['net margin', 1, 1.5], ['margins', 1, 1.5], ['margin', 1, 1.5],
    ['free cash flow', 1, 2], ['operating cash flow', 1, 1.5], ['cash flow', 1, 1.5],
    ['ebitda', 1, 1.5], ['operating income', 1, 1.5], ['earnings', 1, 1.5], ['eps', 1, 1.5],
    ['profitability', 1, 1.5],
    ['bookings', 1, 2], ['backlog', 1, 2], ['orders', 1, 1.5], ['order intake', 1, 1.5],
    ['book to bill', 1, 1.5], ['pipeline', 1, 1.5], ['demand', 1, 2],
    ['arr', 1, 2], ['annual recurring revenue', 1, 2], ['net revenue retention', 1, 2],
    ['net dollar retention', 1, 2], ['subscribers', 1, 1.5], ['customer count', 1, 1], ['customer base', 1, 1], ['paying customers', 1, 1],
    ['active users', 1, 1], ['user base', 1, 1],
    ['market share', 1, 2], ['utilization', 1, 1], ['pricing', 1, 1.5],
    ['average selling price', 1, 1.5], ['asp', 1, 1.5], ['yield', 1, 1],
    ['dividend', 1, 2], ['return on equity', 1, 1.5], ['roic', 1, 1.5],
    ['net interest margin', 1, 1.5], ['loan growth', 1, 1.5], ['deposits', 1, 1],
    ['liquidity', 1, 1.5], ['visibility', 1, 1.5],

    // bad when up
    ['churn', -1, 2], ['attrition', -1, 1.5], ['leverage ratio', -1, 1.5], ['leverage', -1, 1.5],
    ['net debt', -1, 1.5], ['debt', -1, 1], ['borrowings', -1, 1],
    ['inventory', -1, 1], ['inventories', -1, 1], ['days sales outstanding', -1, 1.5], ['dso', -1, 1.5],
    ['costs', -1, 1], ['expenses', -1, 1], ['opex', -1, 1], ['cost of revenue', -1, 1],
    ['cash burn', -1, 2], ['burn rate', -1, 2], ['net loss', -1, 1.5], ['losses', -1, 1.5],
    ['delinquencies', -1, 2], ['charge offs', -1, 2], ['net charge offs', -1, 2],
    ['non performing loans', -1, 2], ['provisions', -1, 1.5], ['credit losses', -1, 2],
    ['returns', -1, 0.5], ['headcount', -1, 0], ['dilution', -1, 1.5],
    ['customer acquisition cost', -1, 1.5], ['cac', -1, 1.5], ['payback period', -1, 1.5],
    ['sales cycles', -1, 1.5], ['sales cycle', -1, 1.5],
  ];

  // Direction words. Type:
  //   up / down     -> combined with metric polarity
  //   good / bad    -> sign is fixed regardless of metric ("improved churn" is good)
  // Third element = strength multiplier.
  const MOVES = [
    // up
    ['increase', 'up', 1], ['increased', 'up', 1], ['rise', 'up', 1], ['rose', 'up', 1],
    ['grow', 'up', 1], ['grew', 'up', 1], ['growth', 'up', 0.8], ['expand', 'up', 1],
    ['expansion', 'up', 1], ['accelerate', 'up', 1.2], ['acceleration', 'up', 1.2],
    ['higher', 'up', 1], ['climb', 'up', 1], ['gain', 'up', 1], ['jump', 'up', 1.3],
    ['surge', 'up', 1.5], ['soar', 'up', 1.5], ['raise', 'up', 1], ['lift', 'up', 1],
    ['elevated', 'up', 1], ['lengthen', 'up', 1], ['elongate', 'up', 1], ['longer', 'up', 1],
    ['up', 'up', 0.8], ['upward', 'up', 1], ['tick up', 'up', 0.6],
    // down
    ['decrease', 'down', 1], ['decline', 'down', 1], ['fall', 'down', 1], ['fell', 'down', 1],
    ['drop', 'down', 1], ['dropped', 'down', 1], ['contract', 'down', 1], ['contraction', 'down', 1],
    ['compress', 'down', 1.2], ['compression', 'down', 1.2], ['decelerate', 'down', 1.2],
    ['deceleration', 'down', 1.2], ['lower', 'down', 1], ['shrink', 'down', 1], ['shrank', 'down', 1],
    ['slow', 'down', 1], ['slowdown', 'down', 1.2], ['slowed', 'down', 1], ['reduce', 'down', 1],
    ['reduction', 'down', 1], ['cut', 'down', 1.2], ['plunge', 'down', 1.5], ['plummet', 'down', 1.5],
    ['downward', 'down', 1], ['down', 'down', 0.8], ['shorter', 'down', 1], ['shorten', 'down', 1], ['tick down', 'down', 0.6],
    // good / bad regardless of metric
    ['improve', 'good', 1], ['improvement', 'good', 1], ['strengthen', 'good', 1],
    ['strong', 'good', 1], ['robust', 'good', 1], ['healthy', 'good', 1], ['solid', 'good', 0.8],
    ['record', 'good', 1.3], ['outperform', 'good', 1.2], ['beat', 'good', 1.2], ['exceed', 'good', 1.2],
    ['deteriorate', 'bad', 1.2], ['deterioration', 'bad', 1.2], ['weaken', 'bad', 1],
    ['weak', 'bad', 1], ['weakness', 'bad', 1], ['soft', 'bad', 1], ['softness', 'bad', 1],
    ['soften', 'bad', 1], ['pressure', 'bad', 1], ['pressured', 'bad', 1], ['erode', 'bad', 1.2],
    ['erosion', 'bad', 1.2], ['miss', 'bad', 1.2], ['disappoint', 'bad', 1.3], ['worsen', 'bad', 1.2],
  ];

  const WINDOW = 5; // max tokens between a metric and its direction word

  // ---------------------------------------------------------------------------
  // 3. STARTER WORD LISTS (finance-aware, written for this project)
  // If you load the Loughran-McDonald dictionary (see tools/convert_lm.py), its
  // Positive / Negative / Uncertainty lists replace these.
  // ---------------------------------------------------------------------------
  const WORDS = {
    positive: [
      'strong', 'strength', 'strengthen', 'robust', 'record', 'exceed', 'exceeded', 'outperform',
      'outperformance', 'improve', 'improved', 'improvement', 'gain', 'momentum', 'favorable',
      'solid', 'healthy', 'efficient', 'efficiency', 'profitable', 'achieve', 'achievement',
      'success', 'successful', 'upside', 'confident', 'confidence', 'opportunity', 'opportunities',
      'excellent', 'exceptional', 'impressive', 'progress', 'tailwind', 'resilient', 'resilience',
      'accretive', 'attractive', 'benefit', 'beneficial', 'positive', 'pleased', 'encouraged',
      'encouraging', 'milestone', 'breakthrough', 'leadership', 'innovative', 'win', 'winning',
      'exciting', 'outstanding', 'stable', 'stability', 'enhance', 'enhanced', 'disciplined',
    ],
    negative: [
      'decline', 'declined', 'weak', 'weaker', 'weakness', 'loss', 'losses', 'impairment',
      'adverse', 'adversely', 'challenging', 'challenge', 'difficult', 'difficulty',
      'deteriorate', 'deterioration', 'headwind', 'pressure', 'disruption', 'delay', 'delayed',
      'shortfall', 'decrease', 'litigation', 'default', 'downturn', 'unfavorable', 'slowdown',
      'miss', 'missed', 'concern', 'concerned', 'unable', 'failure', 'fail', 'layoff', 'layoffs',
      'restructuring', 'volatility', 'volatile', 'weigh', 'weighed', 'soft', 'softness',
      'disappointing', 'disappointed', 'negative', 'negatively', 'erosion', 'contraction',
      'deficit', 'penalty', 'penalties', 'lawsuit', 'breach', 'recall', 'termination',
      'terminated', 'downgrade', 'cautious', 'caution', 'tough', 'problem', 'problems', 'worse',
    ],
    uncertainty: [
      'may', 'might', 'could', 'uncertain', 'uncertainty', 'uncertainties', 'approximately',
      'possible', 'possibly', 'perhaps', 'depend', 'depends', 'dependent', 'contingent',
      'unpredictable', 'unclear', 'unknown', 'risk', 'risks', 'variable', 'fluctuate',
      'fluctuation', 'assume', 'assumption', 'tentative', 'preliminary', 'probable', 'likely',
      'unlikely', 'appear', 'appears', 'seem', 'seems', 'roughly', 'speculative', 'whether',
    ],
  };

  // ---------------------------------------------------------------------------
  // MODIFIERS
  // ---------------------------------------------------------------------------
  const NEGATIONS = [
    'not', 'no', 'never', 'neither', 'nor', 'without', 'dont', 'doesnt', 'didnt', 'isnt',
    'wasnt', 'arent', 'werent', 'cannot', 'cant', 'wont', 'havent', 'hasnt', 'hadnt', 'lack',
    'yet to',
  ];
  const NEGATION_WINDOW = 3;     // tokens before a match
  const NEGATION_FACTOR = -0.5;  // "not yet FCF positive" -> flips and halves

  const INTENSIFIERS = {
    significantly: 1.5, substantially: 1.5, sharply: 1.5, materially: 1.5, meaningfully: 1.4,
    dramatically: 1.6, considerably: 1.4, strongly: 1.3, very: 1.2, extremely: 1.5,
    exceptionally: 1.5, notably: 1.2, further: 1.1, continued: 1.1, sustained: 1.2,
    slightly: 0.5, modestly: 0.6, somewhat: 0.6, marginally: 0.5, partially: 0.6, mildly: 0.6,
    modest: 0.6, slight: 0.5,
  };
  const INTENSIFIER_WINDOW = 2;

  // Sentence-level hedges: positive or negative claims made inside a hedged sentence count less.
  const HEDGES = ['may', 'might', 'could', 'hope', 'hopefully', 'potentially', 'possibly',
    'perhaps', 'if', 'assuming', 'subject to', 'aspire', 'aim'];
  const HEDGE_FACTOR = 0.6;

  // Forward-looking sentence markers (used to split guidance tone from results tone).
  const FORWARD = ['expect', 'expects', 'expected', 'anticipate', 'guidance', 'outlook', 'will',
    'plan', 'plans', 'intend', 'forecast', 'project', 'projected', 'going forward', 'next quarter',
    'next year', 'second half', 'full year', 'fiscal', 'target', 'targeting', 'looking ahead',
    'we see', 'should'];

  // Boilerplate sentences are removed before scoring.
  const BOILERPLATE = [
    'forward looking statement', 'safe harbor', 'private securities litigation reform act',
    'actual results may differ', 'actual results could differ', 'undertake no obligation',
    'assume no obligation', 'this call is being recorded', 'this conference is being recorded',
    'replay of this call', 'non gaap financial measures', 'reconciliation of', 'webcast',
    'investor relations website', 'risk factors section', 'annual report on form 10 k',
    'quarterly report on form 10 q', 'press release issued', 'please refer to',
    'all participants are in a listen only mode', 'question and answer session will follow',
    'press star', 'operator instructions',
  ];

  const STOPWORDS = ['the', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'at',
    'by', 'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'it', 'its', 'this', 'that',
    'these', 'those', 'we', 'our', 'us', 'you', 'your', 'they', 'their', 'i', 'he', 'she', 'which',
    'who', 'what', 'have', 'has', 'had', 'do', 'does', 'did', 'so', 'but', 'if', 'than', 'then',
    'also', 'about', 'into', 'over', 'very', 'just', 'there', 'here', 'all', 'any', 'more', 'most',
    'other', 'some', 'such', 'can', 'will', 'would', 'should', 'could', 'may', 'might', 'quarter',
    'year', 'million', 'billion', 'percent', 'company'];

  root.ER_LEXICON = {
    PHRASES, METRICS, MOVES, WINDOW, WORDS, NEGATIONS, NEGATION_WINDOW, NEGATION_FACTOR,
    INTENSIFIERS, INTENSIFIER_WINDOW, HEDGES, HEDGE_FACTOR, FORWARD, BOILERPLATE, STOPWORDS,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ER_LEXICON;
})(typeof window !== 'undefined' ? window : globalThis);
