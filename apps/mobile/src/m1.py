import sys; sys.path.insert(0,'/tmp/claude-1000/-home-oyinlola-Desktop-zudomart/d68ba207-aa17-439a-99ad-9feb94399c13/scratchpad')
from ed import edit
BL='import { BulletLine } from "@/components/ui/bulletLine";'
IR='import { IconRow } from "@/components/ui/iconRow";'
def ic(*n): return 'import { %s } from "@/components/icons";'%', '.join(n)
edit('components/chat/conversationRow.tsx',[('{conversation.mutedUntil ? <Text size={11} lineHeight={14} color={colors.textMuted} accessibilityLabel="Muted">🔕</Text> : null}','{conversation.mutedUntil ? <View accessible accessibilityLabel="Muted"><BellSlash24Icon size={14} color={colors.textMuted} /></View> : null}')],[ic('BellSlash24Icon')])
edit('screens/messages/conversationInfo.screen.tsx',[('''          <Text size={12} lineHeight={17} color={colors.textMuted} align="center">
            🔒 Messages are end-to-end encrypted. Only people in this chat can read them.
          </Text>''','''          <IconRow icon={<LockSimple24Icon size={14} color={colors.textMuted} />} justify="center" gap={6}>
            <Text size={12} lineHeight={17} color={colors.textMuted} align="center" style={{ flexShrink: 1 }}>
              Messages are end-to-end encrypted. Only people in this chat can read them.
            </Text>
          </IconRow>''')],[ic('LockSimple24Icon'),IR])
edit('screens/creator/creatorSubscribe.screen.tsx',[('<Text key={benefit} size={13} lineHeight={17.5} color={colors.textMuted}>• {benefit}</Text>','<BulletLine key={benefit} size={13} lineHeight={17.5}>{benefit}</BulletLine>')],[BL])
edit('screens/settings/settingsUsername.screen.tsx',[('<Text key={rule} size={12} lineHeight={16.8} color={colors.textMuted}>• {rule}</Text>','<BulletLine key={rule} size={12} lineHeight={16.8}>{rule}</BulletLine>'),('<Text key={note} size={12} lineHeight={16.8} color={colors.textMuted}>• {note}</Text>','<BulletLine key={note} size={12} lineHeight={16.8}>{note}</BulletLine>')],[BL])
edit('components/create/liveMonetizationSheet.tsx',[('<Text key={line} size={12} lineHeight={16.8}>{`• ${line}`}</Text>','<BulletLine key={line} size={12} lineHeight={16.8} color={colors.text}>{line}</BulletLine>')],[BL])
edit('components/settings/deleteAccountSheet.tsx',[('<Text key={line} size={13} lineHeight={18} color={colors.textMuted}>{`• ${line}`}</Text>','<BulletLine key={line} size={13} lineHeight={18}>{line}</BulletLine>')],[BL])
edit('components/creator/revenueRulesCard.tsx',[('<Text key={line} size={13} lineHeight={17.5} color={colors.textMuted}>• {line}</Text>','<BulletLine key={line} size={13} lineHeight={17.5}>{line}</BulletLine>')],[BL])
edit('components/seller/sellerWebAppNote.tsx',[('''        <Text key={tool} size={13} lineHeight={17.5} color={colors.textMuted}>
          • {tool}
        </Text>''','''        <BulletLine key={tool} size={13} lineHeight={17.5}>
          {tool}
        </BulletLine>''')],[BL])
edit('components/order/cartItemSummary.tsx',[('` • ${item.variant}`','` · ${item.variant}`')])
edit('screens/orders/orders.screen.tsx',[(' • ${order.reference} • ',' · ${order.reference} · ')])
edit('screens/explore/search.screen.tsx',[('${store.rating.toFixed(1)} ★ • ${store.reviewCount} reviews','${store.rating.toFixed(1)} rating · ${store.reviewCount} reviews')])
edit('components/store/storeProfileHeader.tsx',[('''            <Text size={14} weight={500} lineHeight={16.8}>
              {store.rating.toFixed(1)} ★ <Text size={14} lineHeight={16.8}>({store.reviewCount})</Text>
            </Text>''','''            <IconRow icon={<Star16Icon size={14} />} gap={4}>
              <Text size={14} weight={500} lineHeight={16.8} accessibilityLabel={`Rated ${store.rating.toFixed(1)} from ${store.reviewCount} reviews`}>
                {store.rating.toFixed(1)} <Text size={14} lineHeight={16.8}>({store.reviewCount})</Text>
              </Text>
            </IconRow>''')],[ic('Star16Icon'),IR])
edit('components/chatSafety/streakBadge.tsx',[('<Text size={size + 2} lineHeight={size + 6}>{isBroken ? "💔" : "🔥"}</Text>','{isBroken ? <HeartBroken24Icon size={size + 4} color={colors.textMuted} /> : <Flame24Icon size={size + 4} color={STREAK_FLAME_COLOR} />}'),('{streak.hourglass ? <Text size={size + 1} lineHeight={size + 5}>⏳</Text> : null}','{streak.hourglass ? <Hourglass24Icon size={size + 2} color={colors.error} /> : null}'),('{streak.milestoneDays ? <Text size={size + 1} lineHeight={size + 5}>🏅</Text> : null}','{streak.milestoneDays ? <Medal24Icon size={size + 2} color={STREAK_MEDAL_COLOR} /> : null}'),('export interface StreakBadgeProps','const STREAK_FLAME_COLOR = "#F97316";\nconst STREAK_MEDAL_COLOR = "#F59E0B";\n\nexport interface StreakBadgeProps')],[ic('Flame24Icon','HeartBroken24Icon','Hourglass24Icon','Medal24Icon')])
edit('components/chatSafety/streakSheet.tsx',[('<Text size={40} lineHeight={48} align="center">{streak.state === "broken" ? "💔" : "🔥"}</Text>','<View style={styles.heroIcon}>{streak.state === "broken" ? <HeartBroken24Icon size={48} color={colors.textMuted} /> : <Flame24Icon size={48} color="#F97316" />}</View>'),('<Text size={13} weight={500} lineHeight={18} color={colors.error} align="center">⏳ Your day ends in {formatHoursAndMinutes(streak.secondsUntilMyDayEnds)}</Text>','<IconRow icon={<Hourglass24Icon size={16} color={colors.error} />} justify="center"><Text size={13} weight={500} lineHeight={18} color={colors.error} align="center">Your day ends in {formatHoursAndMinutes(streak.secondsUntilMyDayEnds)}</Text></IconRow>')],[ic('Flame24Icon','HeartBroken24Icon','Hourglass24Icon'),IR])
edit('components/chatSafety/streakMilestoneCelebration.tsx',[('<Text size={56} lineHeight={64} align="center">🏅</Text>','<Medal24Icon size={64} color="#F59E0B" />')],[ic('Medal24Icon')])
edit('components/chatSafety/sendInChatSheet.tsx',[('{isSelected ? <Text size={12} weight={700} lineHeight={14} color={colors.white}>✓</Text> : null}','{isSelected ? <Check16Icon size={14} color={colors.white} /> : null}')],[ic('Check16Icon')])
edit('components/profile/businessCategoryPicker.tsx',[('<Text size={12} weight={500} lineHeight={16} color={colors.white}>{describeSelection(selection, categories)}  ✕</Text>','<IconRow icon={<Cancel20Icon size={12} color={colors.white} />}><Text size={12} weight={500} lineHeight={16} color={colors.white}>{describeSelection(selection, categories)}</Text></IconRow>')],[ic('Cancel20Icon'),IR])
edit('components/live/battle/battleProposalSheet.tsx',[('accepted: "Accepted ✓"','accepted: "Accepted"')])
