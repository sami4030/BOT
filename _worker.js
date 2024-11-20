// توابع کمکی

async function getFromSAM(key) {
    return (await SamSoft.get(key)) || '';
}

async function saveToSAM(key, value) {
    return await SamSoft.put(key, value);
}


const regexes = {
  uuid: /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  telegramId: /^[0-9]+$/
};

const lengths = {
  uuid: 36,
  telegramId: 15
};

function isValidInput(input, type) {
  return regexes[type].test(input) && input.length <= lengths[type];
}

// توابع عملیات کاربران
async function addUser(username, uuid, expirationTimestamp, telegramId) {
  let existingUUIDs = await getFromSAM('UUID');
  let userDataBase = await getFromSAM('UserDataBase');
  let userCounter = parseInt(await getFromSAM('UserCounter'), 10) || 1000;

  const uuidEntry = `{${username}:${uuid}:${expirationTimestamp}:${telegramId}}`;

  if (existingUUIDs.includes(uuid)) {
    return new Response(`کاربر ${uuid} از قبل وجود دارد ❗`);
  } else {
    existingUUIDs = existingUUIDs ? `${existingUUIDs},${uuid}` : uuid;
    userDataBase = userDataBase ? `${userDataBase},${uuidEntry}` : uuidEntry;
  }

  console.log('Updated UUIDs:', existingUUIDs);
  console.log('Updated User DataBase:', userDataBase);

  await saveToSAM('UUID', existingUUIDs);
  await saveToSAM('UserDataBase', userDataBase);
  await saveToSAM('UserCounter', (userCounter + 1).toString());
  return new Response('کاربر جدید با اعتبار افزوده شد.\n');
}

async function getUsername(uuid) {
  let userDataBase = await getFromSAM('UserDataBase');
  const userEntry = userDataBase.split(',').find(entry => entry.includes(uuid));
  if (userEntry) {
    const [username] = userEntry.split(':');
    return new Response(username);
  }
  return new Response('نام کاربری یافت نشد ❗', { status: 404 });
}

async function getUserCounter() {
  return new Response(await getFromSAM('UserCounter') || '1000');
}

async function checkUserByTelegramId(telegramId) {
  console.log('Checking user by telegram ID:', telegramId);  // لاگ
  let userDataBase = await getFromSAM('UserDataBase');

  if (userDataBase) {
    // حذف گیومه‌ها از داده‌ها
    userDataBase = userDataBase.replace(/['"]/g, '');
    console.log('User data after removing quotes:', userDataBase);  // لاگ

    const userEntries = userDataBase.split('},{').filter(entry => {
      const parts = entry.replace(/{|}/g, '').split(':');
      console.log('Checking entry:', entry);  // لاگ
      return parts[3] === telegramId;
    });

    if (userEntries.length > 0) {
      console.log('Users found:', userEntries);  // لاگ
      return new Response(userEntries.join('},{'));
    }
  }
  console.log('No user found with telegram ID:', telegramId);  // لاگ
  return new Response('هیچ کاربری با این شناسه تلگرام یافت نشد ❗', { status: 404 });
}

async function findByUsername(username) {
  let userDataBase = await getFromSAM('UserDataBase');
  const userEntries = userDataBase.split(',').filter(entry => entry.includes(username));
  if (userEntries.length > 0) {
    return new Response(userEntries.join(','));
  }
  return new Response('هیچ اشتراکی با این نام کاربری یافت نشد ❗', { status: 404 });
}

async function findUser(term) {
  let userDataBase = await getFromSAM('UserDataBase');

  if (userDataBase) {
    // حذف گیومه‌ها از داده‌ها
    userDataBase = userDataBase.replace(/['"]/g, '');
    console.log('User data after removing quotes:', userDataBase);  // لاگ

    const userEntries = userDataBase.split('},{').filter(entry => entry.includes(term));
    if (userEntries.length > 0) {
      console.log('Users found:', userEntries);  // لاگ
      return new Response(userEntries.map(entry => entry.replace(/{|}/g, '')).join('},{'));
    }
  }
  console.log('No user found with term:', term);  // لاگ
  return new Response('هیچ کاربری با این اطلاعات یافت نشد ❗', { status: 404 });
}

// توابع عملیات کاربران (ادامه)
async function checkUUID(uuid) {
  let existingUUIDs = await getFromSAM('UUID');
  if (existingUUIDs.includes(uuid)) {
    return new Response('UUID exists.', { status: 200 });
  }
  return new Response('UUID does not exist.', { status: 404 });
}

async function activateSubscription(uuid) {
  let existingUUIDs = await getFromSAM('UUID');
  let userDataBase = await getFromSAM('UserDataBase');

  if (existingUUIDs.includes(uuid)) {
    return new Response('این اشتراک قبلاً فعال شده است.', { status: 400 });
  }

  existingUUIDs = existingUUIDs ? `${existingUUIDs},${uuid}` : uuid;

  let userEntries = userDataBase.split(',').map(entry => {
    if (entry.includes(uuid)) {
      const parts = entry.split(':');
      parts[0] = parts[0].replace(' 🚫', '');
      return `{${parts.join(':')}}`;
    }
    return entry;
  });

  await saveToSAM('UUID', existingUUIDs);
  await saveToSAM('UserDataBase', userEntries.join(','));
  return new Response('اشتراک با موفقیت فعال شد.');
}

async function deactivateSubscription(uuid) {
  let existingUUIDs = await getFromSAM('UUID');
  let userDataBase = await getFromSAM('UserDataBase');

  if (!existingUUIDs.includes(uuid)) {
    return new Response('این اشتراک قبلاً غیرفعال شده است.', { status: 400 });
  }

  existingUUIDs = existingUUIDs.split(',').filter(item => item !== uuid).join(',');

  let userEntries = userDataBase.split(',').map(entry => {
    if (entry.includes(uuid)) {
      const parts = entry.split(':');
      parts[0] = parts[0].replace(/['"]/g, '') + ' 🚫';
      return `{${parts.join(':')}}`;
    }
    return entry;
  });

  await saveToSAM('UUID', existingUUIDs);
  await saveToSAM('UserDataBase', userEntries.join(','));
  return new Response('اشتراک با موفقیت غیرفعال شد.');
}

async function deleteUser(uuid) {
  let existingUUIDs = await getFromSAM('UUID');
  let userDataBase = await getFromSAM('UserDataBase');

  const uuidList = existingUUIDs.split(',').filter(item => item !== uuid);
  const userList = userDataBase.split(',').filter(item => !item.includes(uuid));

  await saveToSAM('UUID', uuidList.join(','));
  await saveToSAM('UserDataBase', userList.join(','));
  return new Response(`کاربر ${uuid} باموفقیت حذف شد ❌`);
}

async function listUsers(sort = false, showInactiveOnly = false, sortByTime = false) {
  let userDataBase = await getFromSAM('UserDataBase');

  if (userDataBase) {
    // حذف گیومه‌ها از داده‌ها
    userDataBase = userDataBase.replace(/[{}]/g, '');
    let userEntries = userDataBase.split(',');

    if (showInactiveOnly) {
      // فیلتر کردن کاربران غیرفعال
      userEntries = userEntries.filter(entry => entry.includes('🚫'));
    } else if (sortByTime) {
      // فیلتر کردن کاربران فعال که علامت 🚫 ندارند
      userEntries = userEntries.filter(entry => !entry.includes('🚫'));

      // مرتب‌سازی بر اساس زمان اعتبار باقی‌مانده
      userEntries.sort((a, b) => {
        const aTime = parseInt(a.split(':')[2]);
        const bTime = parseInt(b.split(':')[2]);
        return aTime - bTime;
      });
    } else if (sort) {
      // مرتب‌سازی بر اساس زمان ثبت از جدیدترین به قدیمی‌ترین
      userEntries.reverse();
    }

    const result = userEntries.map(entry => {
      const [username, uuid, expirationTimestamp, telegramId] = entry.split(':');
      return `${username}:${uuid}:${expirationTimestamp}:${telegramId}`;
    });

    return new Response(result.join(', '));
  }
  return new Response('No UUIDs found', { status: 404 });
}

async function cleanupExpiredUUIDs(all = false) {
  let existingUUIDs = await getFromSAM('UUID');
  let userDataBase = await getFromSAM('UserDataBase');

  const now = Date.now();
  const expiredUUIDs = existingUUIDs.split(',').filter(uuid => {
    const expirationEntry = userDataBase.split(',').find(entry => entry.includes(uuid));
    if (expirationEntry) {
      const expirationTimestamp = parseInt(expirationEntry.split(':')[2].replace(/['"]/g, ''), 10);
      return expirationTimestamp <= now;
    }
    return false;
  });

  // حذف UUID‌های منقضی‌شده از پایگاه داده UUID
  const updatedUUIDList = existingUUIDs.split(',').filter(uuid => !expiredUUIDs.includes(uuid));
  await saveToSAM('UUID', updatedUUIDList.join(','));

  // به‌روزرسانی نام کاربری با علامت 🚫 برای UUID‌های منقضی‌شده
  let userEntries = userDataBase.split(',');
  userEntries = userEntries.map(entry => {
    const parts = entry.split(':');
    const uuid = parts[1];
    if (expiredUUIDs.includes(uuid)) {
      parts[0] = parts[0].replace(/['"]/g, '') + ' 🚫';
      entry = `{${parts.join(':')}}`;
    }
    return entry;
  });

  await saveToSAM('UserDataBase', userEntries.join(','));

  if (all) {
    // حذف اطلاعات کاربران منقضی‌شده از پایگاه داده User_Data_Base
    const updatedUserDataBase = userDataBase.split(',').filter(entry => {
      const expirationTimestamp = parseInt(entry.split(':')[2].replace(/['"]/g, ''), 10);
      return expirationTimestamp > now;
    });
    await saveToSAM('UserDataBase', updatedUserDataBase.join(','));
    return new Response('کاربران منقضی‌ بطور کامل از تمامی پایگاه‌های داده حذف شدند.');
  }

  return new Response('اشتراک‌های منقضی پاک‌سازی شد.');
}

async function editUser(uuid, days) {
  let userDataBase = await getFromSAM('UserDataBase');
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + days);
  const expirationTimestamp = expirationDate.getTime();

  const userEntryIndex = userDataBase.split(',').findIndex(entry => entry.includes(uuid));
  if (userEntryIndex >= 0) {
    let userEntries = userDataBase.split(',');
    let [username, , , telegramId] = userEntries[userEntryIndex].replace(/[{}]/g, '').split(':');
    userEntries[userEntryIndex] = `{${username}:${uuid}:${expirationTimestamp}:${telegramId}}`;
    await saveToSAM('UserDataBase', userEntries.join(','));
    return new Response(`کاربر با UUID ${uuid} باموفقیت ویرایش شد.`);
  }
  return new Response('کاربری با این UUID یافت نشد ❗', { status: 404 });
}

// توابع مدیریت شناسه تلگرام
async function getTelegramId(uuid) {
  let userDataBase = await getFromSAM('UserDataBase');
  const userEntry = userDataBase.split(',').find(entry => entry.includes(uuid));
  if (userEntry) {
    const [, , , telegram_id] = userEntry.split(':');
    return new Response(telegram_id);
  }
  return new Response('شناسه تلگرام یافت نشد ❗', { status: 404 });
}

// توابع مدیریت درخواست‌ها
async function updateUserData(uuid, field, value) {
    let userDataBase = await getFromSAM('UserDataBase');
    const userEntryIndex = userDataBase.split(',').findIndex(entry => entry.includes(uuid));

    if (userEntryIndex >= 0) {
        let userEntries = userDataBase.split(',');
        let userEntryParts = userEntries[userEntryIndex].replace(/[{}]/g, '').split(':');
        let oldUUID = userEntryParts[1]; // ذخیره UUID قدیمی

        switch (field) {
            case 'username':
                userEntryParts[0] = value.replace(/"/g, '');
                break;
            case 'uuid':
                userEntryParts[1] = value.replace(/"/g, '');
                break;
            case 'expirationTimestamp':
                userEntryParts[2] = value.replace(/"/g, '');
                break;
            case 'telegramId':
                userEntryParts[3] = value.replace(/"/g, '');
                break;
        }

        userEntries[userEntryIndex] = `{${userEntryParts.join(':')}}`;  // افزودن دوباره گیومه‌ها
        await saveToSAM('UserDataBase', userEntries.join(','));

        if (field === 'uuid') {
            let existingUUIDs = await getFromSAM('UUID');
            let uuidList = existingUUIDs.split(',').filter(item => item !== oldUUID);
            uuidList.push(value.replace(/"/g, ''));
            await saveToSAM('UUID', uuidList.join(','));
        }

        return new Response(`مقدار ${field} برای کاربر با UUID ${uuid} باموفقیت به‌روزرسانی شد.`);
    }
    return new Response('کاربری با این UUID یافت نشد ❗', { status: 404 });
}

async function handleRequest(request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const uuid = searchParams.get('uuid');
  const field = searchParams.get('field');
  const value = searchParams.get('value');
  const expiration_timestamp = searchParams.get('expiration_timestamp');
  const telegramId = searchParams.get('telegram_id');
  const term = searchParams.get('term');
  const username = searchParams.get('username');
  const days = parseInt(searchParams.get('days'), 10);

  console.log('Action:', action);
  console.log('UUID:', uuid);
  console.log('Expiration Timestamp:', expiration_timestamp);
  console.log('Telegram ID:', telegramId);
  console.log('Username:', username);

  try {
    switch (action) {
      case 'add':
        if (isValidInput(uuid, 'uuid') && expiration_timestamp && username) {
          if (telegramId && !isValidInput(telegramId, 'telegramId')) {
            return new Response('شناسه تلگرام نامعتبر است ❗', { status: 400 });
          }
          return await addUser(username, uuid, parseInt(expiration_timestamp), telegramId);
        }
        break;
      case 'check_uuid':
        if (uuid) return await checkUUID(uuid);
        break;
      case 'activate_subscription':
        if (uuid) return await activateSubscription(uuid);
        break;
      case 'deactivate_subscription':
        if (uuid) return await deactivateSubscription(uuid);
        break;
      case 'find':
        if (term) return await findUser(term);
        break;
      case 'get_username':
        if (uuid) return await getUsername(uuid);
        break;
      case 'get_user_counter':
        return await getUserCounter();
      case 'find_by_username':
        if (username) return await findByUsername(username);
        break;
      case 'delete':
        if (uuid) return await deleteUser(uuid);
        break;
      case 'check':
        return await checkUserByTelegramId(telegramId); 
      case 'list':
        return await listUsers();
      case 'cleanup':
        return await cleanupExpiredUUIDs();
      case 'cleanup_all':
        return await cleanupExpiredUUIDs(true);
      case 'edit':
        if (uuid && !isNaN(days)) return await editUser(uuid, days);
        break;
      case 'update_user_data':
        if (uuid && field && value) return await updateUserData(uuid, field, value);
        break;
    }
    return new Response('دستور اشتباه است یا کاربر وجود ندارد ❗', { status: 400 });
  } catch (error) {
    console.error('Error handling request:', error);
    return new Response('خطایی در پردازش درخواست رخ داده است ❗', { status: 500 });
  }
}

// تابع اصلی
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});
