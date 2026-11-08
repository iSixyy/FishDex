import axios from "axios";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { RarityBadge } from "@/components/RarityBadge";
import { SegmentedTabs } from "@/components/SegmentedTabs";
import { ShareableCapture, ShareCaptureModal } from "@/components/ShareCaptureModal";
import { TextField } from "@/components/TextField";
import { radius, spacing, ThemeColors, typography } from "@/constants/theme";
import { useStyles, useTheme } from "@/context/ThemeContext";
import { extractErrorMessage, mediaUrl } from "@/services/api";
import {
  FeedScope,
  getCaptureComments,
  getFeed,
  likeCapture,
  postCaptureComment,
  unlikeCapture,
} from "@/services/feedService";
import { formatRelativeTime, formatWeight } from "@/utils/format";
import { CaptureComment, FeedEntry } from "@/types";
import { Alert } from "@/utils/alert";

const PAGE_SIZE = 20;

const SCOPE_OPTIONS: { value: FeedScope; label: string }[] = [
  { value: "highlights", label: "Destacado" },
  { value: "friends", label: "Recientes" },
];

function feedErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err) && err.response?.status === 404) {
    return "La Comunidad todavía no está disponible. Vuelve a intentarlo más tarde.";
  }
  return extractErrorMessage(err);
}

/** Feed de capturas propias y de amigos, con me gusta, comentarios y
 * compartir como imagen. Se usa dentro de la pestaña Social. */
export function CommunityFeed({ header }: { header?: React.ReactElement }) {
  const styles = useStyles(makeStyles);
  const { colors } = useTheme();
  const [scope, setScope] = useState<FeedScope>("highlights");
  const [entries, setEntries] = useState<FeedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const [commentsEntry, setCommentsEntry] = useState<FeedEntry | null>(null);
  const [comments, setComments] = useState<CaptureComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [postingComment, setPostingComment] = useState(false);
  const [sharing, setSharing] = useState<ShareableCapture | null>(null);

  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFeed(scope, PAGE_SIZE, 0)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch((err) => {
        if (cancelled) return;
        setEntries([]);
        setHasMore(false);
        setError(feedErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await getFeed(scope, PAGE_SIZE, 0);
      if (!isMountedRef.current) return;
      setEntries(data);
      setHasMore(data.length === PAGE_SIZE);
      setError(null);
    } catch (err) {
      if (isMountedRef.current) setError(feedErrorMessage(err));
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  };

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore || loading || error) return;
    setLoadingMore(true);
    try {
      const data = await getFeed(scope, PAGE_SIZE, entries.length);
      if (!isMountedRef.current) return;
      // La paginación es por offset: si entra una captura nueva entre dos
      // páginas, la siguiente repite entradas ya mostradas (y FlatList avisa
      // de claves duplicadas). Se descartan las que ya están.
      setEntries((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        return [...prev, ...data.filter((e) => !seen.has(e.id))];
      });
      setHasMore(data.length === PAGE_SIZE);
    } catch {
      // Un fallo al pedir la siguiente página no tira el feed visible.
    } finally {
      if (isMountedRef.current) setLoadingMore(false);
    }
  };

  const handleToggleLike = async (entry: FeedEntry) => {
    const wasLiked = entry.liked_by_me;
    const apply = (liked: boolean, delta: number) =>
      setEntries((prev) =>
        prev.map((e) => (e.id === entry.id ? { ...e, liked_by_me: liked, like_count: e.like_count + delta } : e))
      );
    apply(!wasLiked, wasLiked ? -1 : 1);
    try {
      if (wasLiked) await unlikeCapture(entry.id);
      else await likeCapture(entry.id);
    } catch (err) {
      apply(wasLiked, wasLiked ? 1 : -1);
      Alert.alert("No se ha podido registrar el «me gusta»", extractErrorMessage(err));
    }
  };

  const openComments = async (entry: FeedEntry) => {
    setCommentsEntry(entry);
    setComments([]);
    setCommentsError(null);
    setCommentText("");
    setCommentsLoading(true);
    try {
      const data = await getCaptureComments(entry.id);
      if (isMountedRef.current) setComments(data);
    } catch (err) {
      if (isMountedRef.current) setCommentsError(extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) setCommentsLoading(false);
    }
  };

  const closeComments = () => {
    if (!postingComment) setCommentsEntry(null);
  };

  const handlePostComment = async () => {
    const text = commentText.trim();
    if (!text || !commentsEntry) return;
    const entryId = commentsEntry.id;
    setPostingComment(true);
    try {
      const comment = await postCaptureComment(entryId, text);
      if (!isMountedRef.current) return;
      setComments((prev) => [...prev, comment]);
      setCommentText("");
      setEntries((prev) => prev.map((e) => (e.id === entryId ? { ...e, comment_count: e.comment_count + 1 } : e)));
    } catch (err) {
      Alert.alert("No se ha podido publicar el comentario", extractErrorMessage(err));
    } finally {
      if (isMountedRef.current) setPostingComment(false);
    }
  };

  const renderEntry = ({ item }: { item: FeedEntry }) => {
    const photo = mediaUrl(item.image_url ?? item.thumbnail_url ?? undefined);
    const captionText = item.caption ?? `${item.fish_species_name} de ${formatWeight(item.weight_kg)}`;
    return (
      <Card flush style={styles.post}>
        <View style={styles.postHeader}>
          <Avatar uri={item.user.avatar} name={item.user.display_name} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={styles.postUserName} numberOfLines={1}>
              {item.user.display_name}
            </Text>
            <Text style={styles.postMeta} numberOfLines={1}>
              {formatRelativeTime(item.captured_at)}
              {item.location_name ? ` · ${item.location_name}` : ""}
            </Text>
          </View>
          <RarityBadge rarity={item.rarity} size="sm" />
        </View>

        {photo ? <Image source={{ uri: photo }} style={styles.postImage} resizeMode="cover" /> : null}

        <View style={styles.postBody}>
          <Text style={styles.postCaption}>{captionText}</Text>
          <View style={styles.postActions}>
            <Pressable style={styles.actionButton} onPress={() => handleToggleLike(item)} hitSlop={8}>
              <Icon name="heart" size={20} filled={item.liked_by_me} color={item.liked_by_me ? colors.danger : colors.textSecondary} />
              <Text style={styles.actionLabel}>{item.like_count}</Text>
            </Pressable>
            <Pressable style={styles.actionButton} onPress={() => openComments(item)} hitSlop={8}>
              <Icon name="comment" size={20} color={colors.textSecondary} />
              <Text style={styles.actionLabel}>{item.comment_count}</Text>
            </Pressable>
            <Pressable
              style={styles.shareButton}
              hitSlop={8}
              onPress={() =>
                setSharing({
                  fish_species_name: item.fish_species_name,
                  rarity: item.rarity,
                  weight_kg: item.weight_kg,
                  length_cm: item.length_cm,
                  captured_at: item.captured_at,
                  location_name: item.location_name,
                  image_url: item.image_url,
                  angler_name: item.user.display_name,
                  rank_name: item.user.rank.name,
                })
              }
            >
              <Icon name="share" size={18} color={colors.textPrimary} />
              <Text style={styles.shareLabel}>Compartir</Text>
            </Pressable>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={loading || error ? [] : entries}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderEntry}
        contentContainerStyle={styles.list}
        onEndReachedThreshold={0.4}
        onEndReached={handleLoadMore}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.textPrimary} />}
        ListHeaderComponent={
          <View>
            {header}
            <SegmentedTabs options={SCOPE_OPTIONS} value={scope} onChange={setScope} style={styles.scopeTabs} />
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.textPrimary} style={styles.loadingMore} />
          ) : error ? (
            <EmptyState icon="alert" title="No se ha podido cargar la comunidad" description={error} />
          ) : (
            <EmptyState
              icon="hook"
              title="Todavía no hay publicaciones"
              description="Cuando tú o tus amigos registréis capturas aparecerán aquí."
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.textPrimary} style={styles.loadingMore} /> : null}
      />

      <Modal visible={!!commentsEntry} animationType="slide" transparent onRequestClose={closeComments}>
        <KeyboardAvoidingView style={styles.commentsOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.commentsSheet}>
            <View style={styles.commentsHeader}>
              <Text style={styles.commentsTitle}>comentarios.</Text>
              <Pressable onPress={closeComments} hitSlop={10}>
                <Icon name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
            {commentsLoading ? (
              <ActivityIndicator color={colors.textPrimary} style={styles.loadingMore} />
            ) : commentsError ? (
              <EmptyState icon="alert" title="No se han podido cargar los comentarios" description={commentsError} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => String(c.id)}
                style={styles.commentsList}
                ListEmptyComponent={<EmptyState icon="comment" title="Sé el primero en comentar" />}
                renderItem={({ item }) => (
                  <View style={styles.commentRow}>
                    <Avatar uri={item.user.avatar} name={item.user.display_name} size={30} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.commentUser}>{item.user.display_name}</Text>
                      <Text style={styles.commentText}>{item.text}</Text>
                    </View>
                  </View>
                )}
              />
            )}
            <View style={styles.commentInputRow}>
              <TextField
                value={commentText}
                onChangeText={setCommentText}
                placeholder="Escribe un comentario..."
                containerStyle={{ flex: 1, marginBottom: 0 }}
                maxLength={500}
              />
              <Pressable
                onPress={handlePostComment}
                disabled={postingComment || !commentText.trim()}
                style={[styles.commentSend, (postingComment || !commentText.trim()) && { opacity: 0.4 }]}
              >
                {postingComment ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Icon name="arrow-up" size={18} color={colors.onPrimary} strokeWidth={2.2} />
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ShareCaptureModal capture={sharing} visible={!!sharing} onClose={() => setSharing(null)} />
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    list: { paddingHorizontal: spacing.sm, paddingBottom: spacing.lg, gap: spacing.sm },
    scopeTabs: { marginVertical: spacing.sm },
    post: {},
    postHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md },
    postUserName: { ...typography.subtitle, fontSize: 15, color: c.textPrimary },
    postMeta: { ...typography.caption, color: c.textMuted },
    postImage: { width: "100%", aspectRatio: 4 / 3, backgroundColor: c.surfaceAlt },
    postBody: { padding: spacing.md },
    postCaption: { ...typography.bodyMedium, color: c.textPrimary },
    postActions: { flexDirection: "row", alignItems: "center", gap: spacing.lg, marginTop: spacing.sm },
    actionButton: { flexDirection: "row", alignItems: "center", gap: 6 },
    actionLabel: { ...typography.bodyMedium, color: c.textSecondary },
    shareButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginLeft: "auto",
      borderWidth: 1,
      borderColor: c.borderStrong,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
    },
    shareLabel: { ...typography.caption, color: c.textPrimary },
    loadingMore: { marginVertical: spacing.lg },
    commentsOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: c.scrim },
    commentsSheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      padding: spacing.md,
      maxHeight: "80%",
    },
    commentsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.sm },
    commentsTitle: { ...typography.sectionTitle, fontSize: 13, lineHeight: 20, color: c.textPrimary },
    commentsList: { maxHeight: 360 },
    commentRow: { flexDirection: "row", gap: spacing.sm, paddingVertical: spacing.sm },
    commentUser: { ...typography.caption, color: c.textPrimary, fontFamily: typography.subtitle.fontFamily },
    commentText: { ...typography.body, color: c.textPrimary },
    commentInputRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm, paddingBottom: spacing.md },
    commentSend: { width: 46, height: 46, borderRadius: 23, backgroundColor: c.primary, alignItems: "center", justifyContent: "center" },
  });
