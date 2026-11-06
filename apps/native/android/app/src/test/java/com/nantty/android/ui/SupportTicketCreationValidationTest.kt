package com.nantty.android.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class SupportTicketCreationValidationTest {
    @Test
    fun acceptsReactNativeSubjectAndMessageBoundaryLengths() {
        assertNull(validateSupportTicketForm(SupportTicketFormValues("abcd", "0123456789")))
        assertNull(validateSupportTicketForm(SupportTicketFormValues("s".repeat(80), "m".repeat(1_500))))
    }

    @Test
    fun rejectsSubjectAndMessageOutsideReactNativeBounds() {
        assertEquals("Subject must be 4–80 characters.", validateSupportTicketForm(SupportTicketFormValues("abc", "0123456789")))
        assertEquals("Subject must be 4–80 characters.", validateSupportTicketForm(SupportTicketFormValues("s".repeat(81), "0123456789")))
        assertEquals("Message must be 10–1,500 characters.", validateSupportTicketForm(SupportTicketFormValues("valid", "123456789")))
        assertEquals("Message must be 10–1,500 characters.", validateSupportTicketForm(SupportTicketFormValues("valid", "m".repeat(1_501))))
    }

    @Test
    fun linkedReferenceIsOptionalButValidatedWhenEnabled() {
        assertNull(validateSupportTicketForm(SupportTicketFormValues("valid", "long enough message")))
        assertEquals(
            "Reference ID must be 1–80 characters.",
            validateSupportTicketForm(SupportTicketFormValues("valid", "long enough message", SupportLinkedReferenceInput(SupportLinkedReferenceKind.ORDER, "", "Order 1"))),
        )
        assertEquals(
            "Reference label must be 1–120 characters.",
            validateSupportTicketForm(SupportTicketFormValues("valid", "long enough message", SupportLinkedReferenceInput(SupportLinkedReferenceKind.ORDER, "ref-id", ""))),
        )
    }
}
