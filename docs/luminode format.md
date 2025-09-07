## luminode format
### timeline
```
{
	"success": {boolean},
	"from": {datetime},
	"until": {datetime},
	"total": {int},
	"data": [{
		"type": "message",
		"channel": "channel:{channel_id}",
		"content": "i love decentralized internet <333",
		"created_at": {datetime}
	}]
	"timestamp": {datetime}
	"error": {error message || null}
}
```

### base object
"type" can be either "message", "image", "video", "text", "docs", "etc"
"room_type" can be either "channel", "user", "group"
```
{
	"type": {type},
	"sent_by": "user:{id}",
	"sent_to": "{room_type}:{id}",
	"content": {raw shit},
	"created_at": {datetime},
	"updated_at": {datetime},
	"is_deleted": {boolean},
	"deleted_at": {datetime}
}
```

#### message
*don't forget to use markdown parser to render the message
```
{
	"type": "message",
	"user": "user:{id}",
	"channel": "channel:{channel_id}",
	"content": "i love decentralized internet <333",
	"created_at": {datetime}
}
```

#### image
```
{
	"type": "image",
	"user": "user:{id}",
	"channel": "channel:{channel_id}",
	"content": {raw base64}
	"created_at": {datetime}
}
```

#### video
```
work on it later
```
