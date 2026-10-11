"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/feedback";
import { TextAreaField, TextField } from "@/components/ui/field";
import { AppIcon } from "@/components/ui/appIcon";
import { ArrowLeftIcon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/media";
import { ProfileSkeleton } from "@/components/ui/pageSkeletons";
import { showToast } from "@/components/ui/toast";
import { readErrorMessageForDisplay } from "@/services/clientApi.service";
import { mediaUploadService } from "@/services/mediaUpload.service";
import { usersService } from "@/services/users.service";
import { MediaValidationError, validatePickedMediaBeforeUpload } from "@/utils/mediaUploadRules.util";

import styles from "./page.module.css";

interface PickedImage {
  readonly file: File;
  readonly previewUrl: string;
}

function usePickedImage() {
  const [picked, setPicked] = useState<PickedImage | null>(null);
  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.previewUrl);
  }, [picked]);
  return [picked, setPicked] as const;
}

export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["profile", "me"], queryFn: () => usersService.fetchMyProfile(), retry: false });
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = usePickedImage();
  const [banner, setBanner] = usePickedImage();
  const [pickError, setPickError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement | null>(null);
  const bannerInput = useRef<HTMLInputElement | null>(null);
  const loadedProfileId = useRef<string | null>(null);

  useEffect(() => {
    if (!profile.data || loadedProfileId.current === profile.data.id) return;
    loadedProfileId.current = profile.data.id;
    setName(profile.data.name);
    setBio(profile.data.bio);
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const bannerMediaId = banner ? (await mediaUploadService.uploadFile(banner.file, "banner", () => undefined)).mediaId : undefined;
      const avatarMediaId = avatar ? (await mediaUploadService.uploadFile(avatar.file, "avatar", () => undefined)).mediaId : undefined;
      return usersService.updateMyProfileDetails({ name: name.trim(), bio: bio.trim(), ...(bannerMediaId ? { bannerMediaId } : {}), ...(avatarMediaId ? { avatarMediaId } : {}) });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["profile", "me"], updated);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      showToast({ text: "Profile updated" });
      router.push("/me");
    },
  });

  const pickImage = (file: File | undefined, apply: (image: PickedImage) => void) => {
    setPickError(null);
    if (!file) return;
    try {
      const kind = validatePickedMediaBeforeUpload({ mimeType: file.type, sizeBytes: file.size, durationSeconds: null }, "avatar");
      if (kind !== "image") throw new MediaValidationError("Only photos can be used here.");
      apply({ file, previewUrl: URL.createObjectURL(file) });
    } catch (error) {
      setPickError(error instanceof MediaValidationError ? error.message : "We couldn't use that photo.");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || save.isPending) return;
    save.mutate();
  };

  if (profile.isLoading) return <ProfileSkeleton label="Loading your profile" />;
  if (profile.isError || !profile.data) return <ErrorState description="Couldn't load your profile." error={profile.error} onRetry={() => void profile.refetch()} />;
  const bannerUrl = banner?.previewUrl ?? profile.data.bannerUrl;

  return (
    <form className={styles.page} onSubmit={submit} aria-labelledby="edit-profile-title">
      <header className={styles.header}>
        <button type="button" className={styles.back} aria-label="Back" onClick={() => router.back()}>
          <ArrowLeftIcon size={18} />
        </button>
        <h1 id="edit-profile-title" className={styles.title}>Profile</h1>
      </header>
      <button type="button" className={styles.banner} aria-label="Change cover photo" onClick={() => bannerInput.current?.click()} disabled={save.isPending}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {bannerUrl ? <img src={bannerUrl} alt="" className={styles.bannerImage} /> : null}
        <span className={styles.cameraBadge}><AppIcon name="cameraBolt24" size={20} /></span>
      </button>
      <div className={styles.identity}>
        <button type="button" className={styles.avatarButton} aria-label="Change profile photo" onClick={() => avatarInput.current?.click()} disabled={save.isPending}>
          <Avatar name={name || profile.data.name} src={avatar?.previewUrl ?? profile.data.avatarUrl} size="xl" />
          <span className={styles.cameraBadge}><AppIcon name="cameraBolt24" size={18} /></span>
        </button>
        <div>
          <p className={styles.name}>{name || profile.data.name}</p>
          <p className={styles.handle}>@{profile.data.username}</p>
          <p className={styles.counts}><strong>{profile.data.followers}</strong> followers <strong>{profile.data.following}</strong> following</p>
        </div>
      </div>
      <input ref={avatarInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(event) => { pickImage(event.target.files?.[0], setAvatar); event.target.value = ""; }} />
      <input ref={bannerInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" hidden onChange={(event) => { pickImage(event.target.files?.[0], setBanner); event.target.value = ""; }} />
      {pickError ? <p className={styles.error} role="alert">{pickError}</p> : null}
      <TextField label="Name" value={name} maxLength={50} autoComplete="name" required onChange={(event) => setName(event.target.value)} />
      <TextAreaField label="Bio" value={bio} maxLength={160} rows={3} onChange={(event) => setBio(event.target.value)} hint={`${bio.length}/160`} />
      {save.isError ? <p className={styles.error} role="alert">{save.error instanceof MediaValidationError ? save.error.message : readErrorMessageForDisplay(save.error) || "Couldn't save your profile"}</p> : null}
      <Button type="submit" disabled={!name.trim()} busy={save.isPending}>Save</Button>
    </form>
  );
}
