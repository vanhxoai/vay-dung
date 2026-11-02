import { describe, expect, it } from "vitest";
import licensed from "../../../data/licensed-institutions.json";
import { loadLenders } from "@/lib/data/lenders";
import { LicensedList } from "@/lib/data/schema";
import { checkName, checkSafety, hostnameOf, nameFlags, normalize } from "./check";
import { SIGNS } from "./signs";

const list = LicensedList.parse(licensed).institutions;

const kind = (input: string) => checkName(input, list).kind;
const idOf = (input: string) => {
  const r = checkName(input, list);
  return r.kind === "licensed" ? r.institution.id : null;
};

describe("normalize", () => {
  it("removes accents, case and punctuation", () => {
    expect(normalize("Ngân hàng TMCP Đông Á")).toBe("ngan hang tmcp dong a");
    expect(normalize("  Vay-Tiền!!  ")).toBe("vay tien");
  });
});

describe("licensed names", () => {
  it("recognises lenders however they're typed", () => {
    expect(idOf("FE Credit")).toBe("fe-credit");
    expect(idOf("fecredit")).toBe("fe-credit");
    expect(idOf("FE")).toBe("fe-credit");
    expect(idOf("home credit")).toBe("home-credit");
    expect(idOf("HOMECREDIT")).toBe("home-credit");
    expect(idOf("vp bank")).toBe("vpbank");
    expect(idOf("TPBank")).toBe("tpbank");
  });

  it("recognises everyday bank names, so a real bank never comes back 'not found'", () => {
    expect(idOf("MSB")).toBe("hang-hai");
    expect(idOf("OCB")).toBe("phuong-dong");
    expect(idOf("Eximbank")).toBe("xuat-nhap-khau");
    expect(idOf("SeABank")).toBe("dong-nam-a");
    expect(idOf("PVcomBank")).toBe("dai-chung-viet-nam");
    expect(idOf("MB Bank")).toBe("mb-bank");
    expect(idOf("Cake")).toBe("vpbank");
  });

  it("PGBank and VPBank stay separate, despite both having 'Thịnh Vượng' in their names", () => {
    expect(idOf("PGBank")).toBe("thinh-vuong-va-phat-trien");
    expect(idOf("Ngân hàng TMCP Việt Nam Thịnh Vượng")).toBe("vpbank");
  });

  it("doesn't call an app licensed unless the lender itself says it's theirs", () => {
    expect(kind("Timo")).toBe("not_found");
    expect(kind("$NAP")).toBe("not_found");
  });

  it("recognises full legal names, with or without accents", () => {
    expect(idOf("Ngân hàng TMCP Tiên Phong")).toBe("tpbank");
    expect(idOf("ngan hang tmcp tien phong")).toBe("tpbank");
    expect(idOf("Công ty Tài chính TNHH MTV Home Credit Việt Nam")).toBe("home-credit");
  });

  it("recognises a name without the legal-form words", () => {
    expect(idOf("Ngân hàng Tiên Phong")).toBe("tpbank");
    expect(idOf("Hàng Hải")).toBe("hang-hai");
  });

  it("recognises every institution by its own short and legal name", () => {
    for (const i of list) {
      expect(idOf(i.name), i.name).toBe(i.id);
      expect(idOf(i.legalName), i.legalName).toBe(i.id);
    }
  });

  it("every lender in our data is recognised by its display name", () => {
    for (const l of loadLenders()) {
      expect(kind(l.name), l.name).not.toBe("not_found");
    }
  });
});

describe("web addresses", () => {
  it("recognises the official website listed by SBV", () => {
    const r = checkName("https://www.homecredit.vn/vay-tien", list);
    expect(r).toMatchObject({ kind: "licensed", matchedWebsite: true });
  });

  it("a look-alike domain isn't the real site", () => {
    expect(kind("homecredit-vn.online")).toBe("similar");
    expect(kind("fecredit.vay247.net")).toBe("similar");
  });

  it("hostnameOf only treats web addresses as hosts", () => {
    expect(hostnameOf("home credit")).toBeNull();
    expect(hostnameOf("http://abc.vn/x")).toBe("abc.vn");
  });
});

describe("similar names (possible typo or impersonation)", () => {
  it("catches a licensed name inside a longer one", () => {
    expect(kind("FE Credit Hỗ Trợ Vay Nhanh")).toBe("similar");
    expect(kind("VPBank Online 24h")).toBe("similar");
    expect(kind("MB vay nhanh")).toBe("similar");
  });

  it("catches typos in distinctive names", () => {
    expect(kind("Home Credlt")).toBe("similar");
    expect(kind("Techconbank")).toBe("similar");
    expect(kind("Vietcombnk")).toBe("similar");
  });

  it("short names only match exactly (compliance M10)", () => {
    expect(kind("FEE")).toBe("not_found");
    expect(kind("cafe")).toBe("not_found");
    expect(kind("MBA")).toBe("not_found");
    expect(kind("Life Plus")).toBe("not_found");
  });

  it("legal-form words alone never match", () => {
    expect(kind("ngân hàng")).toBe("not_found");
    expect(kind("công ty tài chính")).toBe("not_found");
    expect(kind("bank")).toBe("not_found");
  });
});

describe("not found", () => {
  it("made-up names aren't on the list", () => {
    expect(kind("Vay Siêu Tốc Xanh")).toBe("not_found");
    expect(kind("Tiền Nhanh Plus")).toBe("not_found");
    expect(kind("Rồng Vàng Credit")).toBe("not_found");
  });

  it("an empty name is not a result", () => {
    expect(kind("   ")).toBe("empty");
    expect(kind("!!!")).toBe("not_found");
  });
});

describe("keyword flags on names", () => {
  it("match whole phrases, without accents", () => {
    expect(nameFlags("Vay Siêu Tốc 24h")).toEqual(["too_easy"]);
    expect(nameFlags("vay nhanh online")).toEqual(["generic_name"]);
    expect(nameFlags("Tải app.apk")).toEqual(["too_easy"]);
  });

  it("don't collide inside other words (compliance M9)", () => {
    expect(nameFlags("Gần Nơi Bạn")).toEqual([]);
    expect(nameFlags("Bảo Đảm")).toEqual([]);
  });

  it("never flag a licensed institution's name", () => {
    for (const i of list) {
      for (const n of [i.name, i.legalName, i.legalNameEn ?? "", ...i.aliases]) expect(nameFlags(n), n).toEqual([]);
    }
  });

  it("a licensed lender's product name is at most a low 'generic' hint, never 'too easy'", () => {
    for (const l of loadLenders()) {
      for (const p of l.products) expect(nameFlags(p.nameVi), p.nameVi).not.toContain("too_easy");
    }
  });

  it("an exact licensed match shows no flags", () => {
    expect(checkSafety("FE Credit", [], list).nameFlags).toEqual([]);
  });
});

describe("checkSafety: level", () => {
  it("a licensed name with nothing ticked stays neutral, and never says 'safe'", () => {
    expect(checkSafety("Home Credit", [], list).level).toBe("neutral");
  });

  it("a high sign means stop, even with a licensed name (impersonators use real names)", () => {
    const r = checkSafety("Home Credit", ["pay_first"], list);
    expect(r.name.kind).toBe("licensed");
    expect(r.level).toBe("stop");
    expect(r.highSigns).toEqual(["pay_first"]);
  });

  it("not found or a medium sign means careful", () => {
    expect(checkSafety("Tiền Nhanh Plus", [], list).level).toBe("careful");
    expect(checkSafety("Home Credit", ["chat_only"], list).level).toBe("careful");
  });

  it("works with signs and no name", () => {
    const r = checkSafety("", ["otp"], list);
    expect(r.name.kind).toBe("empty");
    expect(r.level).toBe("stop");
  });
});

describe("signs", () => {
  it("every sign has a source with a URL and a date", () => {
    for (const s of SIGNS) {
      expect(s.sources.length, s.id).toBeGreaterThan(0);
      for (const src of s.sources) {
        expect(src.url).toMatch(/^https:\/\//);
        expect(src.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});
