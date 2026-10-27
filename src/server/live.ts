// Lớp ghép ở tầng ứng dụng: khi buổi live kết thúc thì xét thưởng xu (SPEC-live.md phần 2 mục 6). Worker và các route
// kết thúc live PHẢI import từ đây để hook được đăng ký.
import { onLiveEnded } from '@/modules/live';
import { rewardLive } from '@/modules/xu';

let registered = false;

function registerAll() {
  if (registered) return;
  registered = true;
  onLiveEnded(async (live) => {
    await rewardLive(live.id);
  });
}

registerAll();

export { syncWithMediaServer, endLive, stopLive, banUserFromLive } from '@/modules/live';
