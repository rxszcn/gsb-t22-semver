"use strict"
const semver = require("../index.js")
const { Range, Comparator, SemVer } = semver
const P = (l, ...v) => console.log(l + " => " + v.map(x => JSON.stringify(x)).join(" | "))

console.log("exports tail:", Object.keys(semver).join(","))

// D. cross-instance pollution: a fresh Range inherits a mutation made on an earlier one
const a = new Range(">=7.7.9")
a.set[0][0].semver = new SemVer("9.9.9")
const b = new Range(">=7.7.9")
P("D1 b.test('9.9.9') (polluted copy)", b.test("9.9.9"))
P("D2 b.test('8.0.0') (should be true for >=7.7.9)", b.test("8.0.0"))
P("D3 a.set[0] === b.set[0] (same cached array)", a.set[0] === b.set[0])

// G. subset vs intersects sweep
const sweep = [
  [">1.2.3 <1.2.4-0", "x"],
  [">1.2.3 <1.2.4-0", "<1.0.0"],
  [">=1.2.3-alpha <1.2.3", ">=1.2.2 <1.2.3-beta"],
  ["<0.0.0-0", ">=0.0.0"],
  ["<0.0.0-0", "<0.0.0-0"],
  [">x", ">=1.0.0"],
  [">=1.0.0 <1.0.0-0", "x"],
]
for (const [a, b] of sweep) {
  const ip = semver.intersects(a, b)
  const s1 = semver.subset(a, b), s2 = semver.subset(b, a)
  const ra = new Range(a), rb = new Range(b)
  const vs = ["0.0.0","0.0.0-0","0.0.0-1","1.0.0","1.0.0-0","1.2.2","1.2.3","1.2.3-alpha","1.2.3-beta","1.2.4","1.2.4-0","2.0.0","2.0.0-0"]
  const overlap = vs.filter(v => ra.test(v) && rb.test(v))
  P("G " + a + " ||| " + b + "  [intersects,subset(a,b),subset(b,a)] overlap?", [ip, s1, s2, overlap.length > 0, overlap])
}

// H. cache options hijack (clean, fresh strings)
const oA = { loose: true }
const rA = new Range(">=9.9.9", oA)
P("H1 first builder comparator.options === own opts", rA.set[0][0].options === oA)
const oB = { loose: true }
const rB = new Range(">=9.9.9", oB)
P("H2 second builder comparator.options === own opts", rB.set[0][0].options === oB)
const rC = new Range(">=9.9.9", { loose: false })
P("H3 strict flags key differs, fresh comparator", rC.set[0][0].options === oA)
P("H4 strict-built range but shared comparator? rC rA set[0] identity", rC.set === rA.set)
// strict rC shares flags0? no—loose:false flags=0; oA flags=2. fresh parse. but rA and rB:
P("H5 rA.set[0] === rB.set[0]", rA.set[0] === rB.set[0])

// I. live mutation (D2 rerun isolated) + via new Range(rangeObj)
const live = { includePrerelease: false }
const rI = new Range(">=8.0.0", live)
P("I1 pre  rI.test('9.0.0-beta')", rI.test("9.0.0-beta"))
live.includePrerelease = true
P("I2 post rI.test('9.0.0-beta') SAME instance", rI.test("9.0.0-beta"))
P("I3 new Range(rI,{}) returns same object?", (() => { const x = new Range(rI, {}); return x === rI })())

// J. loose numeric identifier equality vs intersects string compare
const c1 = new Comparator(">=1.0.0-01", { loose: true })
const c2 = new Comparator("<=1.0.0-1", { loose: true })
P("J1 compare loose", semver.compare("1.0.0-01", "1.0.0-1", { loose: true }))
P("J2 c1.intersects(c2)", c1.intersects(c2, { loose: true }))
P("J3 intersects ranges", semver.intersects(">=1.0.0-01", "<=1.0.0-1", { loose: true }))
P("J4 subset('=1.0.0-01' vs '>=1.0.0-01') loose", semver.subset("1.0.0-01", ">=1.0.0-01", { loose: true }))
P("J5 range test same-tuple", new Range(">=1.0.0-01 <=1.0.0-1", { loose: true }).test("1.0.0-1"))

// K. huge numbers
P("K1 eq huge", semver.eq("99999999999999999999.0.0", "99999999999999999998.0.0"))
P("K2 gt huge", semver.gt("99999999999999999999.0.0", "99999999999999999998.0.0"))
P("K3 range with huge bounds", semver.satisfies("99999999999999999998.5.0", ">99999999999999999999.0.0"))

// L. invalidXRangeOrder strict throw vs loose silent drop
P("L1 validRange('>1.x.3 <2.0.0', loose)", semver.validRange(">1.x.3 <2.0.0", { loose: true }))
try { P("L2 strict", new Range(">1.x.3 <2.0.0").range) } catch (e) { P("L2 strict throws", e.constructor.name) }
P("L3 loose set", new Range(">1.x.3 <2.0.0", { loose: true }).set[0].map(c => c.value))
P("L4 validRange('>1.x.3', loose)", semver.validRange(">1.x.3", { loose: true }))

// M. gtr/ltr README contract: mutually exclusive?
const cases = [["1.2.3-alpha", ">=1.0.0"], ["1.2.3-alpha", ">=1.0.0 <2.0.0"], ["2.0.0-beta", ">=1.0.0 <2.0.0"], ["1.2.3", ">x"], ["1.0.0-rc.1", "1.x"]]
for (const [v, r] of cases) {
  P("M " + v + "  " + r + " [sat,gtr,ltr]", [semver.satisfies(v, r), semver.gtr(v, r), semver.ltr(v, r)])
}

// N. minVersion vs subset contradiction on empty ranges
P("N1 minVersion('>1.2.3 <1.2.4-0')", String(semver.minVersion(">1.2.3 <1.2.4-0")))
P("N2 subset(same,'1.0.0')", semver.subset(">1.2.3 <1.2.4-0", "1.0.0"))
P("N3 isSatisfiable-driven intersects of empty set with itself", semver.intersects(">1.2.3 <1.2.4-0", ">1.2.3 <1.2.4-0"))
P("N4 subset of empty-ish by <0.0.0-0 marker", semver.subset("<0.0.0-0", "1.0.0"))

// O. simplifyRange contract
P("O1 typeof simplifyRange", typeof semver.simplifyRange)
const rr = new Range("1.0.0 || 2.0.0")
const s1 = semver.simplifyRange(["1.0.0", "2.0.0"], rr)
P("O2 returns same object when no simplification", s1 === rr, typeof s1)
const s2 = semver.simplifyRange(["1.0.0", "1.1.0", "2.0.0"], ">=1.0.0 <1.2.0 || 2.0.0")
P("O3", typeof s2, String(s2))

// toComparators contract
P("P1 toComparators('1.2.3 - 2.0.0 || >3')", semver.toComparators("1.2.3 - 2.0.0 || >3"))
P("P2 toComparators('>=0.0.0')", semver.toComparators(">=0.0.0"))
P("P3 roundtrip reparse", semver.toComparators(semver.toComparators("^1.2.3").map(x => x.join(" ")).join(" || ")))
