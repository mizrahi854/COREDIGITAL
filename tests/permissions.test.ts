import { beforeEach, describe, expect, it } from "vitest";
import { createSeed, DEMO_ACCOUNTS } from "../src/data/seed";
import { can } from "../src/domain/permissions";
import { useApp } from "../src/store/app";
import * as act from "../src/store/actions";

/** Permission rules enforced in the action layer (demo only — production enforces them on the server). */
function as(userId: string | null) {
  useApp.setState({ db: createSeed(new Date()), userId, viewMode: "business", toasts: [] });
}
const db = () => useApp.getState().db;

describe("permissions", () => {
  beforeEach(() => as(null));

  it("only business accounts can create content", () => {
    const users = createSeed(new Date()).users;
    const role = (id: string) => users.find((u) => u.id === id)!;
    expect(can.createContent(role(DEMO_ACCOUNTS.customer))).toBe(false);
    expect(can.createContent(role(DEMO_ACCOUNTS.staff))).toBe(false);
    expect(can.createContent(role(DEMO_ACCOUNTS.admin))).toBe(false);
    expect(can.createContent(role(DEMO_ACCOUNTS.owner))).toBe(true);
    as(DEMO_ACCOUNTS.customer);
    const before = db().posts.length;
    const r = act.savePostDraftOrPublish({ kind: "image", media: [{ type: "image", src: "media/square-hair.jpg", source: "test" }], caption: "x", tags: [], cityId: "tlv" }, true);
    expect(r).toBeUndefined();
    expect(db().posts.length).toBe(before);
  });

  it("guests cannot like, save or book", () => {
    const post = db().posts.find((p) => p.status === "published")!;
    expect(act.toggleLike(post.id)).toBeUndefined();
    expect(act.savePost(post.id)).toBeUndefined();
    expect(act.book({ businessId: "b-nova", serviceId: "b-nova-s1", professionalId: null, start: new Date().toISOString(), inspirationPostIds: [] })).toBeUndefined();
  });

  it("a business cannot edit another business's post", () => {
    as(DEMO_ACCOUNTS.owner);
    const other = db().posts.find((p) => p.businessId !== "b-nova")!;
    expect(act.updatePostMeta(other.id, { caption: "hacked" })).toBeUndefined();
    expect(db().posts.find((p) => p.id === other.id)!.caption).not.toBe("hacked");
  });

  it("staff only manage appointments in their own column", () => {
    as(DEMO_ACCOUNTS.staff);
    const me = db().users.find((u) => u.id === DEMO_ACCOUNTS.staff)!;
    const foreign = db().appointments.find((a) => a.businessId === "b-nova" && a.professionalId !== me.professionalId && a.status === "confirmed")!;
    expect(foreign).toBeTruthy();
    expect(act.cancelAsBusiness(foreign.id, "test")).toBeUndefined();
    expect(db().appointments.find((a) => a.id === foreign.id)!.status).toBe("confirmed");
  });

  it("nobody can delete a review; only admins hide one, with a reason that is audited", () => {
    const review = db().reviews[0];
    as(DEMO_ACCOUNTS.owner);
    expect(act.adminSetReviewHidden(review.id, true, "לא אהבתי")).toBeUndefined();
    as(DEMO_ACCOUNTS.admin);
    expect(act.adminSetReviewHidden(review.id, true, "")).toBeUndefined();
    expect(act.adminSetReviewHidden(review.id, true, "תוכן פוגעני")).toBe(true);
    expect(db().reviews.find((r) => r.id === review.id)!.hidden).toBe(true);
    expect(db().audit[0]).toMatchObject({ action: "hide_review", reason: "תוכן פוגעני" });
  });

  it("reviews require the customer's own completed appointment, once", () => {
    as(DEMO_ACCOUNTS.customer);
    const completed = db().appointments.find((a) => a.customerId === DEMO_ACCOUNTS.customer && a.status === "completed" && !db().reviews.some((r) => r.appointmentId === a.id))!;
    const upcoming = db().appointments.find((a) => a.customerId === DEMO_ACCOUNTS.customer && a.status === "confirmed")!;
    expect(act.submitReview(upcoming.id, { rating: 5, text: "" })).toBeUndefined();
    expect(act.submitReview(completed.id, { rating: 5, text: "מעולה" })).toBeTruthy();
    expect(act.submitReview(completed.id, { rating: 4, text: "שוב" })).toBeUndefined();
  });

  it("customers cannot read other customers' conversations", () => {
    as("u-yoav");
    const danas = db().conversations.find((c) => c.customerId === DEMO_ACCOUNTS.customer)!;
    expect(act.sendMessage(danas.id, "שלום")).toBeUndefined();
  });
});
