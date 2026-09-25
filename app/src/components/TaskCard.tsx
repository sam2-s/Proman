import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, Text, View } from 'react-native';
import type { Card } from '../api/types';
import { font, spacing } from '../theme';
import { useTheme } from '../theme/Theme';

const HIDDEN_CARD_HEIGHT = 140;

interface DragState {
  cardId: number | null;
  x: number;
  y: number;
  width: number;
}

type SetDragFn = (
  d: DragState | ((prev: DragState) => DragState),
) => void;

interface Props {
  card: Card;
  onPress: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
  assigneeName?: string | null;
  /** Absolute layout of the card in window coords (measured once). */
  onLayoutInWindow?: (layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => void;
  /** Live drag state shared across the board. */
  drag: DragState;
  setDrag: SetDragFn;
  /** Called with absolute finger position on drop. */
  onDrop: (cardId: number, absX: number, absY: number) => void;
  /** Hide the original card while it is being dragged. */
  isDragging?: boolean;
  /** Viewers cannot drag — disables the pan gesture. Default true. */
  draggable?: boolean;
}

export function TaskCard({
  card,
  onPress,
  onMoveLeft,
  onMoveRight,
  isFirst,
  isLast,
  assigneeName,
  onLayoutInWindow,
  drag,
  setDrag,
  onDrop,
  isDragging,
  draggable = true,
}: Props) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const priorityColor =
    colors.priority[card.priority as keyof typeof colors.priority] ??
    colors.priority.medium;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const active = useSharedValue(false);
  const dragging = useSharedValue(false);

  const startDrag = (absX: number, absY: number, width: number) => {
    setDrag({ cardId: card.id, x: absX, y: absY, width });
  };
  const updateDrag = (absX: number, absY: number) => {
    setDrag((prev) => ({
      cardId: card.id,
      x: absX,
      y: absY,
      width: prev.width || 260,
    }));
  };
  const endDrag = (absX: number, absY: number) => {
    setDrag({ cardId: null, x: 0, y: 0, width: 0 });
    onDrop(card.id, absX, absY);
  };

  const pan = Gesture.Pan()
    .enabled(draggable)
    .minDistance(8)
    .onBegin((e) => {
      runOnJS(startDrag)(e.absoluteX, e.absoluteY, 260);
    })
    .onStart(() => {
      dragging.value = true;
      translateX.value = 0;
      translateY.value = 0;
      active.value = true;
    })
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
      if (dragging.value) {
        runOnJS(updateDrag)(e.absoluteX, e.absoluteY);
      }
    })
    .onFinalize((e) => {
      if (dragging.value || active.value) {
        dragging.value = false;
        active.value = false;
        translateX.value = withSpring(0, { damping: 18 });
        translateY.value = withSpring(0, { damping: 18 });
        runOnJS(endDrag)(e.absoluteX, e.absoluteY);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: withTiming(active.value ? 1.03 : 1, { duration: 120 }) },
    ],
    zIndex: active.value ? 50 : 1,
    shadowOpacity: active.value ? 0.25 : 0,
    opacity: isDragging ? withTiming(0, { duration: 80 }) : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.card, animatedStyle, isDragging && styles.cardHidden]}
        onLayout={(e) => {
          // measureInWindow on native; on web use layout event coords via requestAnimationFrame
          const { x, y, width, height } = e.nativeEvent.layout;
          onLayoutInWindow?.({ x, y, width, height });
        }}
      >
        <View style={{ flexDirection: 'row', flex: 1 }}>
          <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
          <View style={styles.body}>
            <Text style={styles.title} onPress={onPress}>
              {card.title}
            </Text>
            {card.description ? (
              <Text style={styles.desc} numberOfLines={2}>
                {card.description}
              </Text>
            ) : null}
            <View style={styles.meta}>
              <View style={[styles.badge, { backgroundColor: priorityColor + '22' }]}>
                <Text style={[styles.badgeText, { color: priorityColor }]}>
                  {`[${card.priority}]`}
                </Text>
              </View>
              {card.due_date ? (
                <Text style={styles.due}>Due {card.due_date}</Text>
              ) : null}
              {assigneeName ? (
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {assigneeName.slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Text style={styles.dragHint}>⠿ move</Text>
              <Text
                onPress={onMoveLeft}
                style={[styles.arrow, isFirst && styles.arrowDisabled]}
              >
                ←
              </Text>
              <Text
                onPress={onMoveRight}
                style={[styles.arrow, isLast && styles.arrowDisabled]}
              >
                →
              </Text>
              <Text onPress={onPress} style={styles.open}>
                [ open ]
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

/** Floating ghost rendered at the finger while dragging. */
export function DragGhost({
  card,
  drag,
}: {
  card: Card;
  drag: DragState;
}) {
  const colors = useTheme();
  const styles = makeStyles(colors);
  const priorityColor =
    colors.priority[card.priority as keyof typeof colors.priority] ??
    colors.priority.medium;

  if (drag.cardId !== card.id) return null;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.card,
        styles.ghost,
        {
          left: drag.x - drag.width / 2,
          top: drag.y - HIDDEN_CARD_HEIGHT / 2,
          width: Math.max(drag.width, 240),
        },
      ]}
    >
      <View style={{ flexDirection: 'row', flex: 1 }}>
        <View style={[styles.priorityBar, { backgroundColor: priorityColor }]} />
        <View style={styles.body}>
          <Text style={styles.title}>{card.title}</Text>
          <View style={styles.meta}>
            <View style={[styles.badge, { backgroundColor: priorityColor + '22' }]}>
              <Text style={[styles.badgeText, { color: priorityColor }]}>
                {card.priority}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>) {
  return StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  cardHidden: {
    opacity: 0,
    height: 0,
    margin: 0,
    padding: 0,
    borderWidth: 0,
  },
  ghost: {
    position: 'absolute',
    zIndex: 999,
    elevation: 8,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    borderColor: colors.primary,
  },
  priorityBar: { width: 4, alignSelf: 'stretch' },
  body: { flex: 1, padding: spacing.sm + 4 },
  title: {
    fontFamily: font.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  desc: {
    fontFamily: font.mono,
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 15,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  badge: { paddingHorizontal: 0, paddingVertical: 0, borderRadius: 0 },
  badgeText: {
    fontFamily: font.mono,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  due: { fontFamily: font.mono, fontSize: 10, color: colors.textMuted },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  avatarText: { fontFamily: font.mono, fontSize: 10, fontWeight: '800', color: colors.primary },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: spacing.sm,
  },
  dragHint: {
    fontFamily: font.mono,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    marginRight: 'auto',
  },
  arrow: {
    fontFamily: font.mono,
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    paddingHorizontal: 6,
  },
  arrowDisabled: { opacity: 0.3 },
  open: {
    fontFamily: font.mono,
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
});
}
