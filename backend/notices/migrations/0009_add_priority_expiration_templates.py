# Generated migration for priority, expiration, and templates

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('notices', '0008_rename_notices_not_category_idx_notices_not_categor_30f710_idx'),
    ]

    operations = [
        migrations.AddField(
            model_name='notice',
            name='priority',
            field=models.CharField(
                choices=[('urgent', 'Urgent'), ('important', 'Important'), ('normal', 'Normal')],
                default='normal',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='notice',
            name='expires_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name='NoticeTemplate',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('title_template', models.CharField(blank=True, max_length=200)),
                ('description_template', models.TextField()),
                ('category', models.CharField(
                    choices=[('campus_life', 'Campus Life'), ('business', 'Business'), ('education', 'Education'), ('general', 'General')],
                    default='general',
                    max_length=32,
                )),
                ('priority', models.CharField(
                    choices=[('urgent', 'Urgent'), ('important', 'Important'), ('normal', 'Normal')],
                    default='normal',
                    max_length=20,
                )),
                ('is_public', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('created_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notice_templates',
                    to='users.user',
                )),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='NoticeReminder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('remind_at', models.DateTimeField()),
                ('is_sent', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('notice', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='reminders',
                    to='notices.notice',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='notice_reminders',
                    to='users.user',
                )),
            ],
            options={
                'ordering': ['remind_at'],
                'unique_together': {('notice', 'user', 'remind_at')},
            },
        ),
        migrations.AddIndex(
            model_name='notice',
            index=models.Index(fields=['priority'], name='notices_not_priority_idx'),
        ),
        migrations.AddIndex(
            model_name='notice',
            index=models.Index(fields=['expires_at'], name='notices_not_expires_idx'),
        ),
    ]

