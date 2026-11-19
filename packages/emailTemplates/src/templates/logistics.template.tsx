import type { Money } from "../emailTypes";
import { ngn } from "../samples/sampleData";
import { consentRules, defineEmailTemplate } from "./defineTemplate";

const base = { category: "orders", kind: "transactional", audience: "Buyer & Seller", consent: consentRules.always } as const;

export interface LogisticsShipmentProps {
  readonly firstName: string;
  readonly orderNumber: string;
  readonly trackingUrl: string;
  readonly serviceName: string;
  readonly trackingNumber?: string;
  readonly estimatedDelivery?: string;
  readonly fee?: Money;
  readonly actionRequired?: string;
}

const ref = (p: { readonly orderNumber: string }) => `SHIPMENT ${p.orderNumber}`;

export const deliveryBooked = defineEmailTemplate<LogisticsShipmentProps>({
  ...base,
  key: "deliveryBooked",
  name: "Partner delivery booked",
  trigger: "delivery.partnerBookingConfirmed",
  subject: (p) => `Partner pickup scheduled for order ${p.orderNumber}`,
  preheader: (p) => `${p.serviceName} delivery is booked. Track updates directly inside Nantty.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Partner delivery booked", title: "Your courier pickup is scheduled", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.serviceName} has confirmed pickup for order ${p.orderNumber}. You can follow every delivery update inside Nantty.` },
    {
      type: "details",
      rows: [
        { label: "Service", value: p.serviceName },
        ...(p.trackingNumber ? [{ label: "Tracking ref", value: p.trackingNumber }] : []),
        ...(p.estimatedDelivery ? [{ label: "Estimated arrival", value: c.dateTime(p.estimatedDelivery) }] : []),
        ...(p.fee ? [{ label: "Delivery fee", value: c.money(p.fee) }] : []),
      ],
    },
    { type: "button", label: "Track in Nantty", href: p.trackingUrl },
  ],
  sample: {
    firstName: "Amaka",
    orderNumber: "ZM-48213",
    trackingUrl: "https://nantty.com/orders/ZM-48213",
    serviceName: "Nantty Partner (Kwikpik)",
    trackingNumber: "KP-992014",
    estimatedDelivery: "2026-11-17T15:00:00.000Z",
    fee: ngn(350000),
  },
});

export const deliveryPickedUp = defineEmailTemplate<LogisticsShipmentProps>({
  ...base,
  key: "deliveryPickedUp",
  name: "Partner shipment picked up",
  trigger: "delivery.pickedUp",
  subject: (p) => `Order ${p.orderNumber} has been picked up`,
  preheader: (p) => `${p.serviceName} collected the parcel and is heading out.`,
  reference: ref,
  blocks: (p, c) => [
    { type: "hero", eyebrow: "Picked up", title: "Parcel collected by courier", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.serviceName} picked up order ${p.orderNumber}.${p.estimatedDelivery ? ` Estimated arrival: ${c.dateTime(p.estimatedDelivery)}.` : ""}` },
    { type: "button", label: "Track in Nantty", href: p.trackingUrl },
  ],
  sample: {
    firstName: "Amaka",
    orderNumber: "ZM-48213",
    trackingUrl: "https://nantty.com/orders/ZM-48213",
    serviceName: "Nantty Partner (Kwikpik)",
    estimatedDelivery: "2026-11-17T15:00:00.000Z",
  },
});

export const deliveryException = defineEmailTemplate<LogisticsShipmentProps>({
  ...base,
  key: "deliveryException",
  name: "Partner delivery needs attention",
  trigger: "delivery.exception / delivery.partnerBookingFailed",
  subject: (p) => `Action needed for order ${p.orderNumber} delivery`,
  preheader: (p) => p.actionRequired ?? "Open Nantty to review the delivery status.",
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Delivery update", title: "Delivery needs your attention", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, there is a partner delivery update on order ${p.orderNumber}.` },
    { type: "callout", tone: "warn", title: "Next step", text: p.actionRequired ?? "Open your order inside Nantty to review or reschedule delivery." },
    { type: "button", label: "Review in Nantty", href: p.trackingUrl },
  ],
  sample: {
    firstName: "Tunde",
    orderNumber: "ZM-48213",
    trackingUrl: "https://dashboard.nantty.com/orders/ZM-48213",
    serviceName: "Nantty Partner (Kwikpik)",
    actionRequired: "Confirm pickup contact phone number and request a new courier quote.",
  },
});

export const deliveryAttemptFailed = defineEmailTemplate<LogisticsShipmentProps>({
  ...base,
  key: "deliveryAttemptFailed",
  name: "Partner delivery attempt missed",
  trigger: "delivery.attemptFailed",
  subject: (p) => `Missed delivery attempt for order ${p.orderNumber}`,
  preheader: () => "See next steps for redelivery inside Nantty.",
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Attempt missed", title: "Courier could not complete delivery", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.serviceName} attempted to deliver order ${p.orderNumber} but could not hand off the package.` },
    { type: "callout", tone: "neutral", title: "What to do next", text: p.actionRequired ?? "Open your order inside Nantty to check redelivery options." },
    { type: "button", label: "View delivery status", href: p.trackingUrl },
  ],
  sample: {
    firstName: "Amaka",
    orderNumber: "ZM-48213",
    trackingUrl: "https://nantty.com/orders/ZM-48213",
    serviceName: "Nantty Partner (Kwikpik)",
    actionRequired: "Keep your phone reachable for the next courier attempt.",
  },
});

export const deliveryDelivered = defineEmailTemplate<LogisticsShipmentProps>({
  ...base,
  key: "deliveryDelivered",
  name: "Partner shipment delivered",
  trigger: "delivery.delivered",
  subject: (p) => `Order ${p.orderNumber} has been delivered`,
  preheader: () => "Confirm delivery inside Nantty if everything arrived safely.",
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Delivered", title: "Your parcel has arrived", tone: "success" },
    { type: "paragraph", text: `Hi ${p.firstName}, ${p.serviceName} marked order ${p.orderNumber} as delivered. Confirm everything looks right inside Nantty.` },
    { type: "button", label: "Confirm order", href: p.trackingUrl },
  ],
  sample: {
    firstName: "Amaka",
    orderNumber: "ZM-48213",
    trackingUrl: "https://nantty.com/orders/ZM-48213",
    serviceName: "Nantty Partner (Kwikpik)",
  },
});

export const deliveryCancelled = defineEmailTemplate<LogisticsShipmentProps>({
  ...base,
  key: "deliveryCancelled",
  name: "Partner delivery cancelled",
  trigger: "delivery.cancelled",
  subject: (p) => `Partner delivery cancelled for order ${p.orderNumber}`,
  preheader: () => "Open Nantty to view shipment status and next steps.",
  reference: ref,
  blocks: (p) => [
    { type: "hero", eyebrow: "Delivery cancelled", title: "Courier booking was cancelled", tone: "warn" },
    { type: "paragraph", text: `Hi ${p.firstName}, the partner delivery booking for order ${p.orderNumber} was cancelled.` },
    { type: "button", label: "View order in Nantty", href: p.trackingUrl },
  ],
  sample: {
    firstName: "Amaka",
    orderNumber: "ZM-48213",
    trackingUrl: "https://nantty.com/orders/ZM-48213",
    serviceName: "Nantty Partner (Kwikpik)",
  },
});
