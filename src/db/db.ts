import Dexie, { type EntityTable } from 'dexie'
import type { Album, Comment, Like, MediaItem, Settings, Theme, User } from './types'

export class GalleryDB extends Dexie {
  users!: EntityTable<User, 'id'>
  albums!: EntityTable<Album, 'id'>
  media!: EntityTable<MediaItem, 'id'>
  likes!: EntityTable<Like, 'id'>
  comments!: EntityTable<Comment, 'id'>
  themes!: EntityTable<Theme, 'id'>
  settings!: EntityTable<Settings, 'key'>

  constructor() {
    super('lumen-gallery')
    this.version(1).stores({
      users: '++id, &username, role, createdAt',
      albums: '++id, &slug, visibility, sortOrder, updatedAt',
      media: '++id, albumId, kind, sortOrder, [albumId+sortOrder]',
      likes: '++id, userId, mediaId, [userId+mediaId]',
      comments: '++id, userId, mediaId, albumId, createdAt',
      themes: '++id, name, createdAt',
      settings: 'key',
    })
  }
}

export const db = new GalleryDB()
