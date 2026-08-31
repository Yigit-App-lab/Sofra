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
      ? "Today's recipe recommendation is ready. Open Sofra to see it."
      : 'Bugünün tarif önerisi hazır. Görmek için Sofra’yı aç.';
  }

  const names = pending.slice(0, 3).map((item) => item.name).join(', ');
  const remaining = pending.length - 3;
  const listSummary = remaining > 0
    ? english
      ? `${names} and ${remaining} more`
      : `${names} ve ${remaining} ürün daha`
    : names;

  return english
    ? `To buy: ${listSummary}. Today's recipe recommendation is ready.`
    : `Alınacaklar: ${listSummary}. Bugünün tarif önerisi hazır.`;
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
}) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Günlük Sofra hatırlatmaları',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelExistingDailyReminders();
  if (!enabled) return false;

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return false;

  const english = langIndex === 1;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: english ? 'Sofra · Daily recommendation' : 'Sofra · Günlük öneri',
      body: reminderBody(shoppingList, english),
      sound: 'default',
      data: { type: DAILY_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 11,
      minute: 0,
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
  });

  return true;
}
