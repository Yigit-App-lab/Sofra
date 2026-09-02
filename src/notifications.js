import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const DAILY_TYPE = 'sofra-daily-reminder';
const CHANNEL_ID = 'daily-reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function reminderBody(shoppingList, english) {
  const pending = Object.values(shoppingList || {}).filter((item) => !item.checked);

  if (!pending.length) {
    return english
      ? "Dinner made easier: your seasonal, budget-friendly picks are ready."
      : 'Akşam yemeğini kolaylaştıralım: mevsimlik, bütçene uygun önerilerin hazır.';
  }

  const names = pending.slice(0, 3).map((item) => item.name).join(', ');
  const remaining = pending.length - 3;
  const listSummary = remaining > 0
    ? english
      ? `${names} and ${remaining} more`
      : `${names} ve ${remaining} ürün daha`
    : names;

  return english
    ? `Your list: ${listSummary}. Open Sofra and choose tonight's meal.`
    : `Listende: ${listSummary}. Sofra’yı aç, bu akşamın yemeğini seç.`;
}

async function cancelExistingDailyReminders() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = scheduled.filter(
    (notification) => notification.content.data?.type === DAILY_TYPE
  );

  await Promise.all(
    ours.map((notification) =>
      Notifications.cancelScheduledNotificationAsync(notification.identifier)
    )
  );
}

export async function configureDailyReminder({
  enabled,
  shoppingList,
  langIndex,
  hour = 17,
}) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Günlük Sofra hatırlatmaları',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelExistingDailyReminders();
  if (!enabled) return { scheduled:false, permission:'disabled' };

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return { scheduled:false, permission:permission.status };

  const english = langIndex === 1;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: english ? 'What shall we cook today?' : 'Bugün ne pişirsek?',
      body: reminderBody(shoppingList, english),
      sound: 'default',
      data: { type: DAILY_TYPE, url:'sofra:///' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute: 0,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });

  return { scheduled:true, permission:'granted' };
}
