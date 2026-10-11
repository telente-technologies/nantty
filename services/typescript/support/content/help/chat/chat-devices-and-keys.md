---
title: Chat on several devices, new phones and encryption keys
summary: Secure chat works on up to 5 devices. Each device has its own keys, so a new phone or a reinstall starts without your old message history.
tags: new phone, devices, keys, chat history, lost messages, reinstall, web chat, message couldn't be decrypted, switch phone
related: end-to-end-encryption, chat-media-and-encryption, active-sessions, chat-passcode-and-notifications, chat-faq
---

Because chats are end-to-end encrypted, the keys that unlock your messages live on your devices, not on Zudomart's servers. That keeps your chats private, but it also changes what happens when you get a new phone.

## Each device has its own keys

- When you sign in on a phone or on the web (app.zudomart.com), that device creates its own encryption keys and joins secure chat.
- New messages are encrypted separately for each of your devices and each of the other person's devices.
- You can use secure chat on up to 5 devices at once.
- When you sign out on a device, it leaves secure chat and its keys are removed from our key directory.

## New phone or reinstall

Your old messages don't move to a new phone or a fresh install. There's no chat backup, because a backup we could open would break the encryption. On a new device:

- new messages arrive and are readable as normal,
- older messages show "Sent before this device joined secure chat.",
- your own older messages may show "You sent this message. Its text isn't stored on this device."

Before you switch phones, save any photos, documents or details you want to keep. Remember that chat media is deleted after 30 days anyway. See [Media expiry](/help/chat/chat-media-and-encryption).

Your contacts will see a "security code changed" notice after you reinstall or add a device. That's expected. See [End-to-end encryption](/help/chat/end-to-end-encryption).

## Chat on the web

The web app at **app.zudomart.com** supports chat. It counts as one of your 5 devices and keeps its keys in that browser. If you clear your browser data, it joins as a new device next time.

## Messages that won't open

- **"Waiting for this message. Ask the sender to send it again."** The keys for this message haven't arrived yet. Wait a moment, or ask them to resend.
- **"This message couldn't be verified because the sender's security code changed."** Check their security code in **Conversation info** before trusting it.
- **"This message couldn't be decrypted."** Ask the sender to send it again.

## If something goes wrong

- **"Secure chat works on up to 5 devices. Sign out on another device first."** Sign out of an old phone or browser. You can see and end sessions in [Active sessions](/help/account-and-login/active-sessions).
- **"Secure chat isn't set up on this device yet. Try again in a moment."**
- **"They haven't set up secure chat yet. Ask them to open Zudomart, then try again."**
- **"This group has too many devices for one encrypted message."** The group's members have too many devices between them. Try again later, or start a smaller group.

## Stay safe

If you lose your phone, end its session from another device under **Active sessions** and change your password. A chat passcode adds a lock on each device. See [Chat passcode](/help/chat/chat-passcode-and-notifications).
