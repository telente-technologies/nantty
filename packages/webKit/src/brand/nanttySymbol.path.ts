export type NanttySymbolConcept = "meet" | "callResponse" | "moment" | "shift";

export const nanttySymbolColourCandidates = {
  ultramarine: "#3A2BFF",
  zobo: "#A3195B",
  marigold: "#FFA41B",
} as const;

export const nanttySymbolViewBox = 1024;
export const nanttySymbolTileRadius = 229;

export const nanttySymbolConcepts: Record<NanttySymbolConcept, { readonly title: string; readonly path: string }> = {
  meet: {
    title: "Meet",
    path: "M678.6 493C642.6 510 617 545.6 614.2 587.4C609.7 676.8 535.8 747.9 445.3 747.9C351.9 747.9 276.1 672.1 276.1 578.7C276.1 488.2 347.2 414.3 436.6 409.8C478.4 407 514 381.4 531 345.4C548.1 304.7 588.2 276.1 635.1 276.1C697.4 276.1 747.9 326.6 747.9 388.9C747.9 435.8 719.3 475.9 678.6 493Z",
  },
  callResponse: {
    title: "Call and response",
    path: "M231.7 421Q245.2 389 269.8 364.4Q294.5 339.7 326.5 326.2Q359.7 312.2 395.9 312.2Q432.1 312.2 465.3 326.2Q497.3 339.7 522 364.4Q546.6 389 560.2 421Q574.2 454.2 574.2 490.4L449.8 490.4Q449.8 468.1 434 452.3Q418.2 436.5 395.9 436.5Q373.6 436.5 357.8 452.3Q342 468.1 342 490.4C342 524.8 314.2 552.6 279.8 552.6C245.5 552.6 217.6 524.8 217.6 490.4Q217.6 454.2 231.7 421ZM682 533.6C682 499.2 709.8 471.4 744.2 471.4C778.5 471.4 806.4 499.2 806.4 533.6Q806.4 569.8 792.3 603Q778.8 635 754.2 659.6Q729.5 684.3 697.5 697.8Q664.3 711.8 628.1 711.8Q591.9 711.8 558.7 697.8Q526.7 684.3 502 659.6Q477.4 635 463.8 603Q449.8 569.8 449.8 533.6L574.2 533.6Q574.2 555.9 590 571.7Q605.8 587.5 628.1 587.5Q650.4 587.5 666.2 571.7Q682 555.9 682 533.6Z",
  },
  moment: {
    title: "Moment",
    path: "M487.3 742.4C373.7 742.4 281.6 650.3 281.6 536.7C281.6 423.1 373.7 331 487.3 331C495.4 331 503.3 331.4 511.1 332.3C508.5 343.5 507.1 355.2 507.1 367.2C507.1 449.9 574.1 516.9 656.8 516.9C668.8 516.9 680.5 515.5 691.7 512.9C692.6 520.7 693 528.6 693 536.7C693 650.3 600.9 742.4 487.3 742.4ZM656.8 452.7C609.6 452.7 571.3 414.4 571.3 367.2C571.3 319.9 609.6 281.6 656.8 281.6C704.1 281.6 742.4 319.9 742.4 367.2C742.4 414.4 704.1 452.7 656.8 452.7Z",
  },
  shift: {
    title: "Shift",
    path: "M437.3 292.6C544.7 292.6 631.8 379.7 631.8 487.1L242.8 487.1C242.8 379.7 329.9 292.6 437.3 292.6ZM586.7 731.4C479.3 731.4 392.2 644.3 392.2 536.9L781.2 536.9C781.2 644.3 694.1 731.4 586.7 731.4Z",
  },
};

export const defaultNanttySymbol: NanttySymbolConcept = "callResponse";

export const nanttySymbolBounds = { x: 214, y: 308, width: 596, height: 408 } as const;

export function nanttySymbolPath(concept: NanttySymbolConcept = defaultNanttySymbol): string {
  return nanttySymbolConcepts[concept].path;
}
