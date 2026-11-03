export function describeThreadReplyImagePreview(authorName: string) {
  return {
    buttonLabel: `View image in ${authorName}'s reply`,
    dialogTitle: `Image in ${authorName}'s reply`,
    imageAlt: `Image in reply by ${authorName}`,
  } as const;
}
