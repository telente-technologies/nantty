---
title: End-to-end encryption in chats
summary: Your chat messages, photos, videos, voice notes and files are end-to-end encrypted, so Zudomart can't read them. Here's what that covers, what it doesn't, and how to check your security code.
tags: end-to-end encryption, e2ee, encrypted, privacy, can zudomart read my messages, security code, secure chat, signal
related: chat-devices-and-keys, chat-media-and-encryption, reporting-chats, chat-passcode-and-notifications, chat-faq
---

Chats on Zudomart are end-to-end encrypted. Messages are locked on your phone and only unlocked on the phones of the people in the chat. Zudomart's servers pass them along but can't open them.

Chat settings say it plainly: "Messages are end-to-end encrypted. Only you and the people in the chat can read them."

## How it works

Zudomart uses the same design as the Signal protocol: each of your devices has its own keys, and every message gets a fresh key, so one leaked key can't unlock your whole history. Group chats use sender keys, the approach Signal uses for groups. You don't need to set anything up. It's on for every chat.

## What Zudomart can't see

- the text of your messages,
- photos, videos and voice notes,
- documents and their file names,
- link previews you send (they're made on your phone),
- story replies.

## What Zudomart can see

To deliver messages, our servers still know some details:

- who is in a chat, and who sent each message and when,
- the type of message (text, photo, poll and so on),
- whether a message was read, and the chat folder (**Chats**, **Requests**, **Spam**),
- emoji reactions,
- **locations** you share and **polls** (the question, options and votes). These are not end-to-end encrypted, so only share a location with people you trust,
- which post, product, profile or live you shared with **Send in chat** (not your note with it).

## Check your security code

In a one-to-one chat, open **Conversation info** and tap **Security code**: "Compare this code with theirs in person to verify your chat is end-to-end encrypted." It's a 60-digit number shown in groups of five. If both phones show the same code, nobody is in the middle.

If someone reinstalls the app or adds a device, you'll see a notice like "Ada's security code changed. This happens when someone reinstalls or adds a device." In groups: "A member's security code changed." Tap **OK**. If you weren't expecting it, check the code again in person.

## Reporting still works

Because Zudomart can't read chats, a report only includes the messages you choose to send, with your consent. See [Reporting chats](/help/chat/reporting-chats).

## Stay safe

Encryption protects messages in transit, not from the person you're talking to. Zudomart will never ask for your password, card PIN or one-time codes in a chat. Don't send them to anyone, even someone claiming to be from Zudomart.

## If something goes wrong

- **"They haven't set up secure chat yet. Ask them to open Zudomart, then try again."**
- **"Secure chat isn't set up on this device yet. Try again in a moment."**
- **"This message couldn't be decrypted."** See [Chat devices and keys](/help/chat/chat-devices-and-keys).
