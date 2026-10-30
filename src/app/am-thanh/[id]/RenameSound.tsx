'use client';

import { useActionState } from 'react';
import { useT } from '@/i18n/client';
import { renameSoundAction } from './actions';

export function RenameSound({ soundId, title }: { soundId: string; title: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(renameSoundAction.bind(null, soundId), null);
  return (
    <form action={action} className="flex flex-col gap-2" data-testid="sound-rename">
      <label className="flex flex-col gap-1 text-[12px] font-bold text-white/70">
        {t('post.sound.rename')}
        <input
          name="title"
          defaultValue={title}
          maxLength={60}
          className="h-11 rounded-[14px] border border-white/15 bg-white/10 px-3 text-[14px] font-normal text-white"
          data-testid="sound-rename-input"
        />
        <span className="font-normal text-white/50">{t('post.sound.renameHint')}</span>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 w-fit rounded-full bg-white/10 px-4 text-[12px] font-black disabled:opacity-50"
      >
        {t('post.sound.save')}
      </button>
      {state ? (
        <p role="status" className={`text-[12px] font-bold ${state.ok ? 'text-success' : 'text-red-300'}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
