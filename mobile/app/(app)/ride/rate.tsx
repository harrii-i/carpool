import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { toApiError } from '@/api/client';
import { ratingsApi } from '@/api/rewards';
import type { RateableParticipant } from '@/api/types';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Header,
  LoadingState,
  Screen,
  StarRating,
  TextField,
} from '@/components';
import { colors, spacing } from '@/theme';

export default function RateRideScreen() {
  const { rideId } = useLocalSearchParams<{ rideId: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['ratings', 'rateable', rideId],
    queryFn: () => ratingsApi.rateable(String(rideId)),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['ratings', 'rateable', rideId] });
  };

  if (query.isLoading) {
    return (
      <Screen>
        <Header title="Rate your ride" />
        <LoadingState />
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen>
        <Header title="Rate your ride" />
        <ErrorState message={toApiError(query.error).message} onRetry={query.refetch} />
      </Screen>
    );
  }

  const participants = query.data ?? [];
  const allRated = participants.length > 0 && participants.every((p) => p.already_rated);

  return (
    <Screen scroll>
      <Header title="Rate your ride" />

      {participants.length === 0 ? (
        <EmptyState title="Nothing to rate" message="No other participants were found for this ride." />
      ) : (
        <View style={styles.list}>
          {participants.map((p) => (
            <ParticipantRow
              key={p.user_id}
              participant={p}
              rideId={String(rideId)}
              onRated={invalidate}
            />
          ))}

          {allRated ? (
            <Button
              label="Done"
              icon={<CheckCircle2 size={18} color={colors.white} strokeWidth={2.2} />}
              onPress={() => router.back()}
              style={styles.done}
            />
          ) : null}
        </View>
      )}
    </Screen>
  );
}

function ParticipantRow({
  participant,
  rideId,
  onRated,
}: {
  participant: RateableParticipant;
  rideId: string;
  onRated: () => void;
}) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: () =>
      ratingsApi.create({ ride_id: rideId, reviewee_id: participant.user_id, rating, comment }),
    onSuccess: onRated,
    onError: (e) => setError(toApiError(e).message),
  });

  if (participant.already_rated) {
    return (
      <Card style={styles.doneCard}>
        <CheckCircle2 size={20} color={colors.success} strokeWidth={2.2} />
        <AppText variant="bodyStrong" style={styles.doneLabel}>
          You rated {participant.name}
        </AppText>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <AppText variant="cardTitle">{participant.name}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>
        {participant.role === 'driver' ? 'Driver' : 'Passenger'}
      </AppText>

      <StarRating value={rating} onChange={setRating} />

      <TextField
        value={comment}
        onChangeText={setComment}
        placeholder="Add a comment (optional)"
        multiline
      />

      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : null}

      <Button
        label="Submit rating"
        size="md"
        fullWidth={false}
        disabled={rating < 1}
        loading={submit.isPending}
        onPress={() => {
          setError(null);
          submit.mutate();
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md, marginTop: spacing.sm },
  card: { gap: spacing.md },
  doneCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  doneLabel: { flex: 1 },
  done: { marginTop: spacing.sm },
});
