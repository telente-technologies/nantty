---
title: Streaming from a computer with OBS
summary: Use Studio at studio.zudomart.com to get a server URL and stream key, then stream from OBS or any RTMP encoder. Add overlays as a browser source.
tags: obs, encoder, stream key, studio, overlay, rtmp, streamlabs, pc live
related: going-live, live-safety, creator-analytics, live-goals, live-faq
---

Creator Program members can stream from a computer with OBS, Streamlabs or any RTMP encoder. You manage it from Studio.

## Set up

1. Sign in at **studio.zudomart.com** with your Zudomart account.
2. Create a live: add a **Live title**, pick a **Stream category** and choose **Stream for** (yourself, **Just me (no products)**, or a store you belong to).
3. Open the live's control room and tap **Create stream key**.
4. In OBS, open **Settings > Stream** and choose **Custom...** as the service.
5. Paste the **Server URL** into **Server** and the **Stream key** into **Stream Key**.
6. Click **Start Streaming** in OBS, then **Start live** in the control room.
7. When you're done, click **End live**, then stop streaming in OBS.

You can also start an External live from the phone app and paste the server and key it gives you. See [Going live](/help/live/going-live).

## Overlays

Open **Overlay editor** for your live. Use **Add layer** to place text, your logo, shapes, a countdown or a ticker. Overlays render at 1920 x 1080. A live can have up to 10 overlay scenes; the main scene can't be deleted.

In OBS, add the overlay link shown under **OBS browser source** as a **Browser** source at 1920 x 1080. Use it for alerts, gift goals or your logo.

## In the control room

- **Live chat**: read and reply to comments.
- **Pinned products (optional)**: store lives only.
- **Earnings and audience**: peak viewers, gifts, coins, top gifters and battle results.

## Keep your stream key secret

Anyone with your key can stream to your live. If it leaks, click **Rotate stream key** and paste the new key into OBS.

## If something goes wrong

- **"No stream key yet. Create one to connect your encoder."** Click **Create stream key**.
- **"No stream key is active for this live."** Rotate or create a key, then update OBS.
- **"The streaming service is unavailable. Try again shortly."** Our ingest service is busy. Wait and retry.
- **"Only lives started for a store can show and pin that store's products."** Create the live for your store to show products.
- Viewers see nothing? Check that OBS says it's live and that you clicked **Start live**.
