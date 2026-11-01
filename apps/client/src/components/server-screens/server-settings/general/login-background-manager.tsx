import { ImagePicker } from '@/components/image-picker';
import { uploadFile } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import { LOGIN_BACKGROUND_DIM_MAX, type TFile } from '@caesar/shared';
import { Group, Slider } from '@caesar/ui';
import { memo, useCallback } from 'react';
import { toast } from 'sonner';

type TLoginBackgroundManagerProps = {
    background: TFile | null;
    dim: number;
    onDimChange: (dim: number) => void;
    refetch: () => Promise<void>;
};

// Login/sign-up page only. The image saves immediately (like the logo);
// the dim rides the tab's Save button with the other settings.
const LoginBackgroundManager = memo(
    ({
        background,
        dim,
        onDimChange,
        refetch
    }: TLoginBackgroundManagerProps) => {
        const openFilePicker = useFilePicker();

        const removeBackground = useCallback(async () => {
            try {
                await getTRPCClient().others.changeLoginBackground.mutate({
                    fileId: undefined
                });
                await refetch();

                toast.success('Login background removed');
            } catch (error) {
                console.error(error);
                toast.error(
                    'Could not remove the login background. Try again.'
                );
            }
        }, [refetch]);

        const onBackgroundClick = useCallback(async () => {
            try {
                const [file] = await openFilePicker('image/*');
                const temporaryFile = await uploadFile(file);

                if (!temporaryFile) {
                    toast.error('Could not upload the file. Try again.');
                    return;
                }

                await getTRPCClient().others.changeLoginBackground.mutate({
                    fileId: temporaryFile.id
                });
                await refetch();

                toast.success('Login background updated');
            } catch {
                toast.error(
                    'Could not update the login background. Try again.'
                );
            }
        }, [openFilePicker, refetch]);

        return (
            <>
                <Group
                    label="Login background"
                    description="Fills the sign-in and sign-up page behind the form. Not shown inside the app."
                >
                    <ImagePicker
                        image={background}
                        onImageClick={onBackgroundClick}
                        onRemoveImageClick={removeBackground}
                        className="aspect-video h-auto w-full max-w-md"
                    />
                </Group>

                <Group
                    label="Background dim"
                    description="Darkens the background so the form and activity feed stand out. Bright images need more."
                >
                    <div className="max-w-md">
                        <Slider
                            value={[dim]}
                            min={0}
                            max={LOGIN_BACKGROUND_DIM_MAX}
                            step={5}
                            disabled={!background}
                            onValueChange={(values) => onDimChange(values[0])}
                            rightSlot={
                                <span className="w-10 text-right text-sm tabular-nums">
                                    {dim}%
                                </span>
                            }
                        />
                    </div>
                </Group>
            </>
        );
    }
);

LoginBackgroundManager.displayName = 'LoginBackgroundManager';

export { LoginBackgroundManager };
