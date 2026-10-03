import sys; sys.path.insert(0,'/tmp/claude-1000/-home-oyinlola-Desktop-zudomart/d68ba207-aa17-439a-99ad-9feb94399c13/scratchpad')
from ed import edit
IR='import { IconRow } from "@/components/ui/iconRow";'
def ic(*n): return 'import { %s } from "@/components/icons";'%', '.join(n)
INK='liveGlass.ink'
edit('components/live/battle/battleResultBanner.tsx',[
('''        <Text size={13} weight={600} lineHeight={16} color={liveGlass.ink} align="center">
          ⏱ Time! Counting the coins…
        </Text>''','''        <IconRow icon={<Hourglass24Icon size={16} color={liveGlass.ink} />} justify="center">
          <Text size={13} weight={600} lineHeight={16} color={liveGlass.ink} align="center">
            Time! Counting the coins…
          </Text>
        </IconRow>'''),
('''        <Text size={18} weight={700} lineHeight={22} color={liveGlass.ink} align="center">
          🤝 It's a draw!
        </Text>''','''        <IconRow icon={<Handshake24Icon size={22} color={liveGlass.ink} />} justify="center" gap={6}>
          <Text size={18} weight={700} lineHeight={22} color={liveGlass.ink} align="center">
            It's a draw!
          </Text>
        </IconRow>'''),
('''      <Text size={18} weight={700} lineHeight={22} color={liveAccent.goldInk} align="center">
        🏆 {winner.user.name} wins! {praise}
      </Text>''','''      <IconRow icon={<Trophy24Icon size={22} color={liveAccent.goldInk} />} justify="center" gap={6}>
        <Text size={18} weight={700} lineHeight={22} color={liveAccent.goldInk} align="center" style={{ flexShrink: 1 }}>
          {winner.user.name} wins! {praise}
        </Text>
      </IconRow>'''),
('''        <Text size={12} lineHeight={16} color={liveAccent.goldInk} align="center">
          ⭐ MVP supporter: @{battle.mvpGifter.user.username} ({battle.mvpGifter.coins.toLocaleString("en-US")} coins)
        </Text>''','''        <IconRow icon={<Star16Icon size={14} color={liveAccent.goldInk} />} justify="center">
          <Text size={12} lineHeight={16} color={liveAccent.goldInk} align="center" style={{ flexShrink: 1 }}>
            MVP supporter: @{battle.mvpGifter.user.username} ({battle.mvpGifter.coins.toLocaleString("en-US")} coins)
          </Text>
        </IconRow>''')],[ic('Handshake24Icon','Hourglass24Icon','Star16Icon','Trophy24Icon'),IR])
edit('components/live/battle/battleHistoryCard.tsx',[
('return `→ ${payout.earnedCoins','return `${payout.earnedCoins'),
('''        <Text size={13} weight={700} lineHeight={16} color={liveGlass.ink} style={styles.flex}>
          {winner ? `🏆 ${winner.user.name} won` : "🤝 Draw"} · {Math.round(battle.durationSeconds / 60)} min · {describeBattleRule(battle.winnerTakesAll)}
        </Text>''','''        {winner ? <Trophy24Icon size={16} color={liveGlass.ink} /> : <Handshake24Icon size={16} color={liveGlass.ink} />}
        <Text size={13} weight={700} lineHeight={16} color={liveGlass.ink} style={styles.flex}>
          {winner ? `${winner.user.name} won` : "Draw"} · {Math.round(battle.durationSeconds / 60)} min · {describeBattleRule(battle.winnerTakesAll)}
        </Text>'''),
('''        <Text size={11} lineHeight={14} color={liveGlass.inkMuted}>
          ⭐ MVP supporter: @{battle.mvpGifter.user.username}
        </Text>''','''        <IconRow icon={<Star16Icon size={12} color={liveGlass.inkMuted} />}>
          <Text size={11} lineHeight={14} color={liveGlass.inkMuted}>
            MVP supporter: @{battle.mvpGifter.user.username}
          </Text>
        </IconRow>''')],[ic('Handshake24Icon','Star16Icon','Trophy24Icon'),IR])
edit('components/live/battle/battleScoreBar.tsx',[('''        <Text size={12} lineHeight={14}>
          ⚡
        </Text>''','''        <Lightning24Icon size={14} color="#FFFFFF" />''')],[ic('Lightning24Icon')])
edit('components/live/gifts/liveGiftGoalBar.tsx',[('''          <Text size={11} weight={600} lineHeight={14} color={liveGlass.ink} numberOfLines={1} style={styles.title}>
            {goal.status === "completed" ? "✓ " : ""}
            {goal.title}
          </Text>''','''          <View style={styles.title}>
            {goal.status === "completed" ? <Check16Icon size={12} color={liveGlass.ink} /> : null}
            <Text size={11} weight={600} lineHeight={14} color={liveGlass.ink} numberOfLines={1} style={styles.titleText}>
              {goal.title}
            </Text>
          </View>''')],[ic('Check16Icon')])
edit('components/live/battle/battleGiftPickerSheet.tsx',[('''                  <Text size={10} lineHeight={12} color={colors.textMuted}>
                    🪙 {gift.priceCoins.toLocaleString("en-US")}
                  </Text>''','''                  <IconRow icon={<Coin24Icon size={12} />} justify="center" gap={3}>
                    <Text size={10} lineHeight={12} color={colors.textMuted}>
                      {gift.priceCoins.toLocaleString("en-US")}
                    </Text>
                  </IconRow>''')],[ic('Coin24Icon'),IR])
edit('components/live/guests/liveStageTile.tsx',[
('''          <Text size={11} weight={700} lineHeight={13} color={liveGlass.ink}>
            🪙 {participant.score.toLocaleString("en-US")}
          </Text>''','''          <IconRow icon={<Coin24Icon size={13} />} gap={3}>
            <Text size={11} weight={700} lineHeight={13} color={liveGlass.ink}>
              {participant.score.toLocaleString("en-US")}
            </Text>
          </IconRow>'''),
('''          <Text size={28} lineHeight={32}>
            👑
          </Text>''','''          <Crown24Icon size={32} color={liveAccent.gold} />'''),
('''          <Text size={10} lineHeight={12}>
            🔇
          </Text>''','''          <MicrophoneSlash24Icon size={12} color={liveGlass.ink} />''')],[ic('Coin24Icon','Crown24Icon','MicrophoneSlash24Icon'),IR])
edit('components/live/guests/liveStageControlRail.tsx',[('readonly glyph: string;','readonly glyph: ReactNode;'),('''          <Text size={18} lineHeight={22}>
            {button.glyph}
          </Text>''','''          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {button.glyph}
          </View>'''),('import { Pressable','import type { ReactNode } from "react";\nimport { Pressable')],[])
edit('components/live/guests/liveStageRailButtons.util.ts',[
('glyph: "⏳"','glyph: <Hourglass24Icon size={20} color={RAIL_INK} />'),('glyph: "🏁"','glyph: <Flag24Icon size={20} color={RAIL_INK} />'),('glyph: "⚔️"','glyph: <Swords24Icon size={20} color={RAIL_INK} />'),('glyph: "👥"','glyph: <Users24Icon size={20} color={RAIL_INK} />'),
('glyph: me.audioMuted ? "🔇" : "🎙️"','glyph: me.audioMuted ? <MicrophoneSlash24Icon size={20} color={RAIL_INK} /> : <Microphone24Icon size={20} color={RAIL_INK} />'),
('glyph: "📷"','glyph: me.videoMuted ? <Camera24Icon size={20} color={RAIL_INK} /> : <VideoCamera24Icon size={20} color={RAIL_INK} />'),
('glyph: "🚪"','glyph: <SignOut24Icon size={20} color={RAIL_INK} />'),('glyph: "🙋"','glyph: <Hand24Icon size={20} color={RAIL_INK} />'),
('const confirmEndingBattleEarly','const RAIL_INK = liveGlass.ink;\n\nconst confirmEndingBattleEarly')],[ic('Camera24Icon','Flag24Icon','Hand24Icon','Hourglass24Icon','Microphone24Icon','MicrophoneSlash24Icon','SignOut24Icon','Swords24Icon','Users24Icon','VideoCamera24Icon'),'import { liveGlass } from "../liveSurface.constant";'])
