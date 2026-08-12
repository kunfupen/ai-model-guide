// The AMG Eval suite.
//
// Design goals (see evals/README.md for the full methodology):
//  1. CONTAMINATION-RESISTANT — most tasks are procedurally generated from a
//     seed over invented entities, so they cannot be memorised from training
//     data. Change the seed and you get a fresh, equally hard exam.
//  2. DETERMINISTICALLY GRADED — every task has a machine-checkable answer.
//     No LLM-as-judge anywhere in the scoring path.
//  3. CHEAP — ~18 prompts per model, so a full run costs cents and minutes.
//  4. FAIR — identical prompt text and token budget for every model.

const SUITE_VERSION = "1.0";

/** mulberry32 — small, fast, reproducible PRNG. */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const int = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// Invented vocabulary — deliberately not real products, places, or people.
const UNITS = ["vantrel", "morrix", "quillet", "brimsel", "dactyl", "yorrin"];
const DEPOTS = ["Kessreth", "Volarn", "Trennik", "Pelidor", "Xanquay", "Ormbeck"];
const AGENTS = ["Ravik", "Solenne", "Tarquist", "Imbra", "Cordwen", "Nyalla"];

/** Unbiased Fisher-Yates using the seeded PRNG. */
function shuffle(r, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildSuite(seed = 20260724) {
  const r = rng(seed);
  const tasks = [];

  // ---------------------------------------------------------------- category 1
  // Instruction-following: strict, unambiguous format compliance.
  {
    const n = int(r, 4, 7);
    const tag = pick(r, UNITS).toUpperCase();
    tasks.push({
      id: "if-lines",
      category: "instruction-following",
      weight: 1,
      maxTokens: 400,
      prompt:
        `Output exactly ${n} lines and nothing else — no preamble, no closing remark, no blank lines.\n` +
        `Every line must start with "${tag}-" followed by a two-digit number, counting up from 01.\n` +
        `Example of the required shape (do not reuse these numbers): ${tag}-07\n` +
        `Produce exactly ${n} lines now.`,
      grader: {
        type: "lines",
        count: n,
        eachMatches: `^${tag}-\\d{2}$`,
      },
      reference: Array.from({ length: n }, (_, i) => `${tag}-${String(i + 1).padStart(2, "0")}`).join("\n"),
    });

    const banned = pick(r, ["water", "energy", "signal", "network"]);
    tasks.push({
      id: "if-constraint",
      category: "instruction-following",
      weight: 1,
      maxTokens: 400,
      prompt:
        `Write two sentences describing how a river delta forms.\n` +
        `Hard constraint: you must NOT use the word "${banned}" (in any casing or as part of another word).\n` +
        `Return only the two sentences.`,
      // Compound: obeying the ban is not enough — the model must actually do the
      // task, so a refusal or an evasion cannot score.
      grader: {
        type: "all",
        of: [
          { type: "excludesAll", substrings: [banned] },
          { type: "sentences", min: 2, max: 3 },
          { type: "containsAny", substrings: ["sediment", "deposit", "silt", "channel", "delta", "river", "mouth"], min: 2 },
        ],
      },
      reference:
        "Sediment carried down the river settles where the current slows near the mouth. Over time those deposits build outward into a branching fan of channels, forming the delta.",
    });

    const code = `${pick(r, UNITS).slice(0, 3).toUpperCase()}${int(r, 100, 999)}`;
    tasks.push({
      id: "if-template",
      category: "instruction-following",
      weight: 1,
      maxTokens: 300,
      prompt:
        `Reply using EXACTLY this template, substituting the bracketed parts and keeping the labels verbatim:\n\n` +
        `REF: ${code}\nSTATUS: <one word, either ACTIVE or DORMANT>\nCOUNT: <the number of vowels in the string "${code}">\n\n` +
        `Use STATUS ACTIVE. Output nothing before or after the three lines.`,
      grader: {
        type: "regexAll",
        patterns: [`^REF: ${code}$`, `^STATUS: ACTIVE$`, `^COUNT: ${(code.match(/[AEIOUaeiou]/g) ?? []).length}$`],
        flags: "m",
      },
      reference: `REF: ${code}\nSTATUS: ACTIVE\nCOUNT: ${(code.match(/[AEIOUaeiou]/g) ?? []).length}`,
    });
  }

  // ---------------------------------------------------------------- category 2
  // Structured output: parse a synthetic record and emit exact JSON.
  {
    const rows = Array.from({ length: 5 }, () => ({
      agent: pick(r, AGENTS),
      depot: pick(r, DEPOTS),
      qty: int(r, 10, 400),
    }));
    // Guarantee unique agents so the answer is unambiguous.
    const seen = new Set();
    const uniq = rows.filter((x) => (seen.has(x.agent) ? false : (seen.add(x.agent), true)));
    const top = uniq.reduce((a, b) => (b.qty > a.qty ? b : a));
    const total = uniq.reduce((s, x) => s + x.qty, 0);
    const blob = uniq.map((x) => `${x.agent} | ${x.depot} | ${x.qty}`).join("\n");

    tasks.push({
      id: "so-extract",
      category: "structured-output",
      weight: 1,
      maxTokens: 600,
      prompt:
        `Here is a manifest, one record per line in the form "agent | depot | quantity":\n\n${blob}\n\n` +
        `Return ONLY a JSON object (no markdown, no commentary) with exactly these keys:\n` +
        `  "topAgent": the agent with the highest quantity\n` +
        `  "topDepot": that same record's depot\n` +
        `  "totalQuantity": the sum of all quantities\n` +
        `  "recordCount": how many records there are`,
      grader: {
        type: "json",
        equals: { topAgent: top.agent, topDepot: top.depot, totalQuantity: total, recordCount: uniq.length },
      },
      reference: JSON.stringify({
        topAgent: top.agent,
        topDepot: top.depot,
        totalQuantity: total,
        recordCount: uniq.length,
      }),
    });

    const items = Array.from({ length: 4 }, () => ({ u: pick(r, UNITS), n: int(r, 2, 40) }));
    const byUnit = {};
    for (const it of items) byUnit[it.u] = (byUnit[it.u] ?? 0) + it.n;
    const sortedUnits = Object.keys(byUnit).sort();
    tasks.push({
      id: "so-aggregate",
      category: "structured-output",
      weight: 1,
      maxTokens: 600,
      prompt:
        `Given these measurements: ${items.map((i) => `${i.n} ${i.u}`).join(", ")}.\n\n` +
        `Sum the values per unit, then return ONLY a JSON array (no markdown) of objects sorted alphabetically by unit, ` +
        `each shaped exactly {"unit": <string>, "total": <number>}.`,
      grader: {
        type: "json",
        arrayLength: sortedUnits.length,
        equals: Object.fromEntries(
          sortedUnits.flatMap((u, i) => [
            [`${i}.unit`, u],
            [`${i}.total`, byUnit[u]],
          ]),
        ),
      },
      reference: JSON.stringify(sortedUnits.map((u) => ({ unit: u, total: byUnit[u] }))),
    });
  }

  // ---------------------------------------------------------------- category 3
  // Numeric reasoning: multi-step arithmetic over invented scenarios.
  {
    const crates = int(r, 12, 40);
    const per = int(r, 6, 19);
    const broken = int(r, 3, 11);
    const price = int(r, 3, 15);
    const answer = (crates * per - broken) * price;
    tasks.push({
      id: "nr-chain",
      category: "numeric-reasoning",
      weight: 1,
      maxTokens: 900,
      prompt:
        `A depot receives ${crates} crates. Each crate holds ${per} ${pick(r, UNITS)}s. ` +
        `During unloading ${broken} individual items are destroyed. ` +
        `The remaining items sell for ${price} credits each.\n\n` +
        `What is the total revenue in credits? Reason step by step, then end your reply with the final number on its own line.`,
      grader: { type: "numeric", answer },
      reference: `${crates} x ${per} = ${crates * per}; minus ${broken} = ${crates * per - broken}; x ${price}\n${answer}`,
    });

    const start = int(r, 200, 900);
    const pct = pick(r, [10, 20, 25, 50]);
    const addBack = int(r, 15, 90);
    const afterDrop = start - Math.round((start * pct) / 100);
    const answer2 = afterDrop + addBack;
    tasks.push({
      id: "nr-percent",
      category: "numeric-reasoning",
      weight: 1,
      maxTokens: 900,
      prompt:
        `A reservoir holds ${start} units. It loses ${pct}% of its volume, then ${addBack} units are pumped back in.\n\n` +
        `How many units does it hold now? Show your reasoning, then end with the final number alone on the last line.`,
      grader: { type: "numeric", answer: answer2 },
      reference: `After the ${pct}% loss: ${afterDrop}. Adding ${addBack}.\n${answer2}`,
    });

    // Per-parcel rates must differ, else the puzzle has no unique solution.
    const c = int(r, 2, 8);
    const a = c + int(r, 1, 5);
    const b = int(r, 3, 12);
    // Solve: a*x + b = c*x + (b + delta)  =>  x = delta / (a - c).
    // Choose delta = (a - c) * x so x is a clean integer.
    const x = int(r, 2, 15);
    const delta = (a - c) * x;
    const answer3 = x;
    tasks.push({
      id: "nr-algebra",
      category: "numeric-reasoning",
      weight: 1,
      maxTokens: 900,
      prompt:
        `Two shipping plans cost the same for some number of parcels x.\n` +
        `Plan A costs ${a} credits per parcel plus a flat ${b} credits.\n` +
        `Plan B costs ${c} credits per parcel plus a flat ${b + delta} credits.\n\n` +
        `For what value of x do the two plans cost the same? Reason it out, then end with the number alone on the final line.`,
      grader: { type: "numeric", answer: answer3 },
      reference: `(${a} - ${c})x = ${delta}, so x = ${answer3}\n${answer3}`,
    });
  }

  // ---------------------------------------------------------------- category 4
  // Code correctness: graded by hidden tests the model never sees.
  {
    const k = int(r, 2, 4);
    tasks.push({
      id: "code-runlength",
      category: "code-correctness",
      weight: 1.5,
      maxTokens: 900,
      prompt:
        `Write a JavaScript function with this exact signature:\n\n` +
        `  export function compress(input)\n\n` +
        `It takes a string and returns a run-length encoded string where any run of ${k} or more identical ` +
        `consecutive characters becomes "<count><char>". Runs shorter than ${k} are copied through unchanged.\n` +
        `Example with threshold 3: "aaabbc" -> "3abbc".\n\n` +
        `Return ONLY the code, no explanation. Use \`export function\`.`,
      grader: {
        type: "codeExec",
        entry: "compress",
        cases: (() => {
          const enc = (s) => {
            let out = "";
            let i = 0;
            while (i < s.length) {
              let j = i;
              while (j < s.length && s[j] === s[i]) j++;
              const run = j - i;
              out += run >= k ? `${run}${s[i]}` : s[i].repeat(run);
              i = j;
            }
            return out;
          };
          const samples = ["aaabbc", "xyz", "mmmmmmnnnp", "", "qqqq", "abbbbbbc"];
          return samples.map((s) => ({ args: [s], expect: enc(s) }));
        })(),
      },
      reference:
        `export function compress(input) {\n` +
        `  let out = ""; let i = 0;\n` +
        `  while (i < input.length) {\n` +
        `    let j = i;\n` +
        `    while (j < input.length && input[j] === input[i]) j++;\n` +
        `    const run = j - i;\n` +
        `    out += run >= ${k} ? String(run) + input[i] : input[i].repeat(run);\n` +
        `    i = j;\n` +
        `  }\n` +
        `  return out;\n}`,
    });

    const mod = int(r, 3, 9);
    tasks.push({
      id: "code-filtersum",
      category: "code-correctness",
      weight: 1.5,
      maxTokens: 900,
      prompt:
        `Write a JavaScript function with this exact signature:\n\n` +
        `  export function tally(numbers)\n\n` +
        `It takes an array of integers and returns the sum of every element that is divisible by ${mod}, ` +
        `EXCLUDING any element that is negative. If no element qualifies, return 0.\n\n` +
        `Return ONLY the code, no explanation. Use \`export function\`.`,
      grader: {
        type: "codeExec",
        entry: "tally",
        cases: (() => {
          const f = (arr) => arr.filter((n) => n >= 0 && n % mod === 0).reduce((s, n) => s + n, 0);
          const samples = [
            [1, 2, 3, 4, 5, 6],
            [-mod, mod, mod * 2],
            [],
            [7, 11, 13],
            [0, mod * 5, -1],
          ];
          return samples.map((a) => ({ args: [a], expect: f(a) }));
        })(),
      },
      reference:
        `export function tally(numbers) {\n` +
        `  return numbers.filter((n) => n >= 0 && n % ${mod} === 0).reduce((s, n) => s + n, 0);\n}`,
    });
  }

  // ---------------------------------------------------------------- category 5
  // Long-context retrieval: a planted fact inside generated filler.
  {
    const needleAgent = pick(r, AGENTS);
    const needleCode = `${pick(r, UNITS).slice(0, 2).toUpperCase()}-${int(r, 1000, 9999)}`;
    const filler = [];
    for (let i = 0; i < 120; i++) {
      filler.push(
        `Log entry ${i + 1}: routine transfer at depot ${pick(r, DEPOTS)}; ` +
          `${int(r, 1, 99)} ${pick(r, UNITS)}s reconciled without incident.`,
      );
    }
    const insertAt = int(r, 40, 100);
    filler.splice(
      insertAt,
      0,
      `Log entry ${insertAt + 1}: clearance token ${needleCode} was issued to ${needleAgent} for the night shift.`,
    );
    tasks.push({
      id: "lc-needle",
      category: "long-context-retrieval",
      weight: 1,
      maxTokens: 300,
      prompt:
        `Read the following log carefully.\n\n${filler.join("\n")}\n\n` +
        `Question: which clearance token was issued, and to whom? ` +
        `Answer with only the token, a space, and the person's name — nothing else.`,
      grader: { type: "containsAll", substrings: [needleCode, needleAgent] },
      reference: `${needleCode} ${needleAgent}`,
    });
  }

  // ---------------------------------------------------------------- category 6
  // Constraint satisfaction: a small ordering puzzle with a unique solution.
  {
    const order = shuffle(r, AGENTS).slice(0, 4); // ground truth, positions 1..4
    const people = shuffle(r, order); // present them in a different order than the answer
    // These four clues pin the arrangement uniquely:
    //   D last, C immediately before D, B immediately after A  =>  A B C D
    const clues = shuffle(r, [
      `${order[3]} is last.`,
      `${order[2]} is immediately before ${order[3]}.`,
      `${order[1]} is immediately after ${order[0]}.`,
      `${order[0]} is not in the final two positions.`,
    ]);
    tasks.push({
      id: "cs-ordering",
      category: "constraint-satisfaction",
      weight: 1,
      maxTokens: 900,
      prompt:
        `Four inspectors — ${people.join(", ")} — each take one slot in a queue, positions 1 through 4.\n\n` +
        `Clues:\n${clues.map((c) => `- ${c}`).join("\n")}\n\n` +
        `Work out the unique order. Then output ONLY the four names in order, comma-separated, on a single line.`,
      grader: { type: "exact", accept: [order.join(", "), order.join(",")] },
      reference: order.join(", "),
    });
  }

  return { version: SUITE_VERSION, seed, tasks };
}

export const CATEGORIES = [
  "instruction-following",
  "structured-output",
  "numeric-reasoning",
  "code-correctness",
  "long-context-retrieval",
  "constraint-satisfaction",
];

export { SUITE_VERSION };
