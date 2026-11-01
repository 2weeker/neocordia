import { ImagePicker } from '@/components/image-picker';
import { uploadFile } from '@/helpers/upload-file';
import { useFilePicker } from '@/hooks/use-file-picker';
import { getTRPCClient } from '@/lib/trpc';
import type { TFile } from '@caesar/shared';
import { Group } from '@caesar/ui';
import { memo, useCallback } from 'react';
import { toast } from 'sonner';

type TShareBannerManagerProps = {
    shareBanner: TFile | null;
    refetch: () => Promise<void>;
};

// og:image for link previews; server falls back to the logo without one
const ShareBannerManager = memo(
    ({ shareBanner, refetch }: TShareBannerManagerProps) => {
        const openFilePicker = useFilePicker();

        const removeBanner = useCallback(async () => {
            try {
                await getTRPCClient().others.changeShareBanner.mutate({
                    fileId: undefined
                });
                await refetch();

                toast.success('Share banner removed');
            } catch (error) {
                console.error(error);
                toast.error('Could not remove the share banner. Try again.');
            }
        }, [refetch]);

        const onBannerClick = useCallback(async () => {
            try {
                const [file] = await openFilePicker('image/*');
                const temporaryFile = await uploadFile(file);

                if (!temporaryFile) {
                    toast.error('Could not upload the file. Try again.');
                    return;
                }

                await getTRPCClient().others.changeShareBanner.mutate({
                    fileId: temporaryFile.id
                });
                await refetch();

                toast.success('Share banner updated');
            } catch {
                toast.error('Could not update the share banner. Try again.');
            }
        }, [openFilePicker, refetch]);

        return (
            <Group
                label="Share banner"
                description="Shown as the large image when your server's link is shared on Discord, X and other apps. 1200×630 works best. Without one, the logo is used."
            >
                <ImagePicker
                    image={shareBanner}
                    onImageClick={onBannerClick}
                    onRemoveImageClick={removeBanner}
                    className="aspect-[1200/630] h-auto w-full max-w-md"
                />
            </Group>
        );
    }
);

ShareBannerManager.displayName = 'ShareBannerManager';

export { ShareBannerManager };
