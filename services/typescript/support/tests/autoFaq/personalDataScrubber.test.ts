import { describe, expect, it } from "vitest";

import { findResidualPersonalData, scrubPersonalData } from "../../src/modules/autoFaq/services/personalDataScrubber.service.js";

const scrub = (text: string, context = {}) => scrubPersonalData(text, context).text;

describe("personal data scrubber", () => {
  it.each([
    ["amaka.obi@gmail.com", "[email]"],
    ["AMAKA_OBI+shop@Yahoo.co.uk", "[email]"],
    ["write to amaka at gmail dot com", "write to [email]"],
    ["amaka(at)gmail(dot)com", "[email]"],
  ])("removes email addresses: %s", (input, expected) => expect(scrub(input)).toBe(expected));

  it.each([
    "08031234567", "0803 123 4567", "0803-123-4567", "+234 803 123 4567", "+2348031234567", "2348031234567", "(0803) 123 4567", "+44 20 7946 0958", "+1 (415) 555-0100", "+254 712 345 678",
  ])("removes phone number %s", (phone) => {
    const result = scrubPersonalData(`call me on ${phone} today`);
    expect(result.text).not.toMatch(/\d{3}/);
    expect(result.text).toContain("call me on");
  });

  it("removes order numbers, ticket references, uuids and platform ids", () => {
    const text = scrub("Order ZM-48213, ticket SUP-20419, ref RF-20261003-8841, ord_7F3K2Q, dsp_4Q8N2L, id 3f2a1b4c-1111-4222-8333-123456789abc, order number 77812345");
    expect(text).not.toMatch(/48213|20419|8841|7F3K2Q|4Q8N2L|3f2a1b4c|77812345/);
  });

  it.each([
    ["I paid ₦25,000", "I paid [amount]"],
    ["refund of NGN 25000 please", "refund of [amount] please"],
    ["it cost 5,000 naira", "it cost [amount]"],
    ["sent N15000 yesterday", "sent [amount] yesterday"],
    ["charged $20.50 twice", "charged [amount] twice"],
    ["£12 and €9.99", "[amount] and [amount]"],
    ["KSh 1,200 for delivery", "[amount] for delivery"],
    ["GHS 300 back", "[amount] back"],
  ])("removes money amounts tied to a person: %s", (input, expected) => expect(scrub(input)).toBe(expected));

  it("does not treat ordinary words next to numbers as currency", () => {
    expect(scrub("it arrived in 3 days for 2 items")).toBe("it arrived in 3 days for 2 items");
    expect(scrub("Escrow releases 3 days after delivery and the fee is 1.5%")).toBe("Escrow releases 3 days after delivery and the fee is 1.5%");
  });

  it("removes card numbers that pass the Luhn check, bank account numbers and identity numbers", () => {
    const text = scrub("Card 4111 1111 1111 1111, account 0123456789, BVN 22334455667, NIN 12345678901");
    expect(text).not.toMatch(/4111|0123456789|22334455667|12345678901/);
  });

  it("removes street addresses, PO boxes, postcodes and stated addresses", () => {
    expect(scrub("Deliver to 12 Admiralty Way, Lekki Phase 1, Lagos.")).toBe("Deliver to [address].");
    expect(scrub("No. 4 Bode Thomas Street, Surulere please")).not.toMatch(/Bode Thomas/);
    expect(scrub("P.O. Box 1234")).toBe("[address]");
    expect(scrub("send it to SW1A 1AA")).toBe("send it to [address]");
    expect(scrub("my address is flat 3 opposite the big mosque in Kano. Thanks")).toMatch(/^\[address\]\./);
  });

  it("removes names from greetings, introductions, sign-offs, honorifics and known participants", () => {
    const text = scrub("Hi Amaka, my name is Tunde Bakare and Mrs. Okonkwo said the seller is Funke Adebayo.\nThanks,\nDeji", { knownNames: ["Deji Ade"] });
    expect(text).not.toMatch(/Amaka|Tunde|Bakare|Okonkwo|Funke|Adebayo|Deji/);
    expect(text).toContain("[name]");
  });

  it("removes the requester's name and username wherever they appear", () => {
    const text = scrub("AMAKA here, @amaka_obi. Amaka needs help.", { knownNames: ["Amaka Obi"], knownUsernames: ["amaka_obi"] });
    expect(text).not.toMatch(/amaka/i);
  });

  it("removes handles, links, IP addresses and dates", () => {
    const text = scrub("Seller @funke.naturals posted https://zudomart.com/funke?ref=abc from 192.168.1.20 on 03/10/2026 and www.example.com");
    expect(text).not.toMatch(/funke|192\.168|03\/10|example/);
  });

  it("removes digits hidden with spacing and zero-width characters", () => {
    expect(scrub("0803​123​4567")).not.toMatch(/\d{3}/);
  });

  it("keeps platform vocabulary and product steps intact", () => {
    const steps = "Go to Settings > Privacy & Data and tap Download your data. Open Seller Dashboard then Orders. Ads Manager shows Creator Program earnings.";
    expect(scrub(steps)).toBe(steps);
  });

  it("reports residual personal data so it can be held for review", () => {
    expect(findResidualPersonalData("Thanks for waiting, the refund was sent")).toEqual([]);
    expect(findResidualPersonalData("call 0 8 0 3 1 2 3 4 5 6 7")).toContain("digits");
    expect(findResidualPersonalData("mail me at someone @ mail . com")).toContain("email");
    expect(findResidualPersonalData("paid ₦5")).toContain("money");
  });

  it("leaves no residual personal data after scrubbing a realistic ticket", () => {
    const ticket = "Hello, I'm Ifeoma Nwosu (@ifeoma.art). I paid ₦48,500 for order ZM-99120 on 2026-09-30 to 14 Allen Avenue, Ikeja. My number is 0809 555 1212 and email ifeoma@art.ng. Card ending 5399 8300 0000 0008. Please help!";
    const result = scrubPersonalData(ticket, { knownNames: ["Ifeoma Nwosu"], knownUsernames: ["ifeoma.art"] });
    expect(findResidualPersonalData(result.text)).toEqual([]);
    expect(result.text).not.toMatch(/Ifeoma|Nwosu|48,500|99120|Allen|0809|art\.ng|5399/);
    expect(result.redactionCount).toBeGreaterThanOrEqual(7);
  });
});
