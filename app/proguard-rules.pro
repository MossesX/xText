# Keep the components that the system instantiates by name.
-keep class com.mossesx.xtext.** extends android.app.Service { *; }
-keep class com.mossesx.xtext.** extends android.content.BroadcastReceiver { *; }
-keep class com.mossesx.xtext.** extends android.app.Activity { *; }
