package app.daymate.planner;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** Обычное напоминание: мягкий звук на громкости уведомлений. */
    public static final String CHANNEL_REMINDER = "daymate_reminder";
    /** Повтор без ответа: настойчивый звук на громкости будильника. */
    public static final String CHANNEL_REPEAT = "daymate_repeat_loud";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        createReminderChannels();
        super.onCreate(savedInstanceState);
    }

    /**
     * Звук и громкость в Android задаются каналом уведомлений, а не отдельным уведомлением,
     * поэтому «громче» реализовано вторым каналом. Каналы создаются один раз; дальше
     * пользователь может менять их звук в системных настройках приложения.
     */
    private void createReminderChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel soft = new NotificationChannel(
                CHANNEL_REMINDER, "Напоминания", NotificationManager.IMPORTANCE_HIGH);
        soft.setDescription("Первое напоминание о событии или приёме лекарства");
        soft.setSound(rawSound(R.raw.daymate_soft), new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build());
        soft.enableVibration(true);
        soft.setVibrationPattern(new long[] {0, 250});
        manager.createNotificationChannel(soft);

        NotificationChannel loud = new NotificationChannel(
                CHANNEL_REPEAT, "Повторные напоминания (громкие)", NotificationManager.IMPORTANCE_HIGH);
        loud.setDescription("Повтор, если на напоминание не ответили. Звучит на громкости будильника");
        loud.setSound(rawSound(R.raw.daymate_loud), new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_ALARM)
                .build());
        loud.enableVibration(true);
        loud.setVibrationPattern(new long[] {0, 600, 250, 600, 250, 600, 250, 900});
        manager.createNotificationChannel(loud);
    }

    private Uri rawSound(int resId) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + getPackageName() + "/" + resId);
    }
}
