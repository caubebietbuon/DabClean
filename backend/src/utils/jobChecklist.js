function getRequiredAreas(serviceName = '', category = '') {
  const normalizedName = (serviceName || '').toLocaleLowerCase('vi');

  // Dịch vụ chăm sóc tại nhà: Không áp dụng quy trình chụp ảnh phòng vệ sinh
  if (category === 'care' || normalizedName.includes('chăm sóc') || normalizedName.includes('bảo mẫu') || normalizedName.includes('điều dưỡng')) {
    return [];
  }

  if (normalizedName.includes('sofa') || normalizedName.includes('nệm') || normalizedName.includes('rèm')) {
    return ['Sofa / Nệm / Rèm'];
  }

  if (normalizedName.includes('văn phòng') || normalizedName.includes('workspace')) {
    return ['Khu vực làm việc', 'Phòng họp', 'Khu vực chung', 'Nhà vệ sinh'];
  }

  return ['Phòng khách', 'Phòng ngủ', 'Bếp', 'Toilet'];
}

function getPhotoProgress(areas, photos) {
  const beforePhotos = photos.filter(photo => photo.stage === 'before');
  const afterPhotos = photos.filter(photo => photo.stage === 'after');
  const missingBeforeAreas = areas.filter(area =>
    !beforePhotos.some(photo => photo.area_name === area)
  );
  const missingAfterAngles = beforePhotos.filter(before =>
    !afterPhotos.some(after =>
      after.area_name === before.area_name && after.angle_id === before.angle_id
    )
  );

  return {
    missingBeforeAreas,
    missingAfterAngles,
    canStart: missingBeforeAreas.length === 0,
    canComplete: missingBeforeAreas.length === 0 && missingAfterAngles.length === 0
  };
}

module.exports = { getRequiredAreas, getPhotoProgress };
