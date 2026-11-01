import { SettingsFooterActions } from '@/components/server-screens/settings-footer-actions';
import { useAdminRetention } from '@/features/server/admin/hooks';
import {
    RETENTION_MAX_COUNT,
    RETENTION_MAX_DAYS,
    type TRetentionSettings
} from '@caesar/shared';
import {
    Alert,
    AlertDescription,
    Button,
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    Group,
    Input,
    LoadingCard,
    Separator
} from '@caesar/ui';
import { TriangleAlert } from 'lucide-react';
import { memo } from 'react';

type TPreset = { label: string; value: number };

const COUNT_PRESETS: TPreset[] = [
    { label: '500', value: 500 },
    { label: '1,000', value: 1_000 },
    { label: '10,000', value: 10_000 },
    { label: 'Unlimited', value: 0 }
];

const DAY_PRESETS: TPreset[] = [
    { label: '30 days', value: 30 },
    { label: '90 days', value: 90 },
    { label: '1 year', value: 365 },
    { label: 'Forever', value: 0 }
];

type TRetentionControlProps = {
    value: number;
    max: number;
    unit: string;
    presets: TPreset[];
    onChange: (value: number) => void;
};

// number input + quick presets; 0 means "keep forever"
const RetentionControl = memo(
    ({ value, max, unit, presets, onChange }: TRetentionControlProps) => (
        <div className="flex flex-col gap-2 max-w-150 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    className="h-8 w-28 text-sm"
                    min={0}
                    max={max}
                    step={1}
                    value={value}
                    onChange={(e) => {
                        const next = Number(e.target.value);

                        if (!Number.isFinite(next)) return;

                        onChange(Math.max(0, Math.min(Math.round(next), max)));
                    }}
                />
                <span className="text-xs text-muted-foreground">
                    {value === 0 ? 'keep forever' : unit}
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {presets.map((preset) => (
                    <Button
                        key={preset.label}
                        size="sm"
                        variant={value === preset.value ? 'default' : 'outline'}
                        onClick={() => onChange(preset.value)}
                    >
                        {preset.label}
                    </Button>
                ))}
            </div>
        </div>
    )
);

RetentionControl.displayName = 'RetentionControl';

const Retention = memo(() => {
    const { values, loading, submit, onChange } = useAdminRetention();

    if (loading) {
        return <LoadingCard className="h-[600px]" />;
    }

    const control = (key: keyof TRetentionSettings, kind: 'count' | 'days') => (
        <RetentionControl
            value={values[key]}
            max={kind === 'count' ? RETENTION_MAX_COUNT : RETENTION_MAX_DAYS}
            unit={kind === 'count' ? 'messages' : 'days'}
            presets={kind === 'count' ? COUNT_PRESETS : DAY_PRESETS}
            onChange={(value) => onChange(key, value)}
        />
    );

    return (
        <Card>
            <CardHeader>
                <CardTitle>Retention</CardTitle>
                <CardDescription>
                    Automatically delete old messages and logs so the server
                    doesn't grow forever. Set a value to 0 to keep everything.
                </CardDescription>
                <SettingsFooterActions onSave={submit} loading={loading} />
            </CardHeader>
            <CardContent className="space-y-4">
                <Alert variant="destructive">
                    <TriangleAlert />
                    <AlertDescription>
                        Deletion is permanent. Cleanup runs every 15 minutes, so
                        lowering a limit removes existing history at the next
                        run. Pinned messages are always kept and don't count
                        toward the limit. Attachments of deleted messages are
                        removed too.
                    </AlertDescription>
                </Alert>

                <h3 className="text-sm font-semibold">Channels</h3>

                <Group
                    label="Max messages per channel"
                    description="Only the newest messages in each text channel are kept."
                >
                    {control('messageRetentionMaxCount', 'count')}
                </Group>

                <Group
                    label="Max message age"
                    description="Channel messages older than this are deleted."
                >
                    {control('messageRetentionMaxAgeDays', 'days')}
                </Group>

                <Separator />

                <h3 className="text-sm font-semibold">Direct messages</h3>

                <Group
                    label="Max messages per conversation"
                    description="Only the newest messages in each DM conversation are kept."
                >
                    {control('dmRetentionMaxCount', 'count')}
                </Group>

                <Group
                    label="Max message age"
                    description="DM messages older than this are deleted. Ephemeral DMs still expire after 24 hours on their own."
                >
                    {control('dmRetentionMaxAgeDays', 'days')}
                </Group>

                <Separator />

                <h3 className="text-sm font-semibold">Logs</h3>

                <Group
                    label="Login and activity history"
                    description="Login records (device, hashed IP) and the activity log older than this are deleted."
                >
                    {control('logRetentionDays', 'days')}
                </Group>
            </CardContent>
        </Card>
    );
});

Retention.displayName = 'Retention';

export { Retention };
