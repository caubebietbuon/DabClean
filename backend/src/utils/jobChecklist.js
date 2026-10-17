function getRequiredAreas(serviceName = '', category = '') {
  const normalizedName = (serviceName || '').toLocaleLowerCase('vi');

  if (normalizedName.includes('sofa') || normalizedName.includes('nệm') || normalizedName.includes('rèm')) {
    return ['Sofa / Nệm / Rèm'];
  }

  if (normalizedName.includes('văn phòng') || normalizedName.includes('workspace')) {
    return ['Khu vực làm việc', 'Khu vực chung', 'Nhà vệ sinh'];
  }

  if (normalizedName.includes('công trình') || normalizedName.includes('xây dựng')) {
    return ['Hiện trường thi công', 'Khu vực sàn & kính'];
  }

  if (category === 'care' || normalizedName.includes('chăm sóc') || normalizedName.includes('bảo mẫu') || normalizedName.includes('điều dưỡng')) {
    return ['Khu vực làm việc'];
  }

  return ['Phòng khách', 'Phòng ngủ', 'Bếp', 'Toilet'];
}

function getPhotoProgress(areas, photos) {
  const beforePhotos = (photos || []).filter(photo => photo.stage === 'before');
  const afterPhotos = (photos || []).filter(photo => photo.stage === 'after');

  const missingBeforeAreas = (areas || []).filter(area =>
    !beforePhotos.some(photo => photo.area_name === area)
  );
  const missingAfterAngles = beforePhotos.filter(before =>
    !afterPhotos.some(after =>
      after.area_name === before.area_name && after.angle_id === before.angle_id
    )
  );

  return {
    beforeCount: beforePhotos.length,
    afterCount: afterPhotos.length,
    missingBeforeAreas,
    missingAfterAngles,
    canStart: beforePhotos.length > 0,
    canComplete: beforePhotos.length > 0 && afterPhotos.length > 0 && missingAfterAngles.length === 0
  };
}

module.exports = { getRequiredAreas, getPhotoProgress };
