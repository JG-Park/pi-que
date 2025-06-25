'use client'

import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  List, 
  Loader2, 
  Youtube, 
  ExternalLink, 
  Download,
  User,
  Lock,
  Globe,
  PlayCircle,
  Clock
} from 'lucide-react'
import { usePlaylist, PlaylistVideo, PlaylistInfo, UserPlaylist } from '@/hooks/business/use-playlist'
import { useAuth } from '@/contexts/auth-context'
import { useToast } from '@/hooks/use-toast'

interface PlaylistImportProps {
  onImportVideos: (videos: any[], playlistTitle: string) => void
}

export function PlaylistImport({ onImportVideos }: PlaylistImportProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [playlistUrl, setPlaylistUrl] = useState('')
  const [selectedPlaylist, setSelectedPlaylist] = useState<{ playlist: PlaylistInfo; videos: PlaylistVideo[] } | null>(null)
  const [myPlaylists, setMyPlaylists] = useState<UserPlaylist[]>([])
  const [activeTab, setActiveTab] = useState('url')
  
  const { user } = useAuth()
  const { toast } = useToast()
  const { 
    loading, 
    error, 
    fetchPlaylist, 
    fetchMyPlaylists, 
    prepareVideosForQueue,
    clearError 
  } = usePlaylist()

  const handleFetchPlaylist = async () => {
    if (!playlistUrl.trim()) {
      toast({
        title: "오류",
        description: "재생목록 URL을 입력해주세요.",
        variant: "destructive",
      })
      return
    }

    const result = await fetchPlaylist(playlistUrl)
    if (result) {
      setSelectedPlaylist(result)
    } else if (error) {
      toast({
        title: "재생목록 로드 실패",
        description: error,
        variant: "destructive",
      })
    }
  }

  const handleLoadMyPlaylists = async () => {
    if (!user) {
      toast({
        title: "로그인 필요",
        description: "개인 재생목록을 보려면 Google 로그인이 필요합니다.",
        variant: "destructive",
      })
      return
    }

    const playlists = await fetchMyPlaylists()
    setMyPlaylists(playlists)
    
    if (error) {
      toast({
        title: "재생목록 로드 실패", 
        description: error,
        variant: "destructive",
      })
    }
  }

  const handleSelectMyPlaylist = async (playlist: UserPlaylist) => {
    const result = await fetchPlaylist(playlist.id)
    if (result) {
      setSelectedPlaylist(result)
      setActiveTab('preview')
    }
  }

  const handleImportPlaylist = () => {
    if (!selectedPlaylist) return

    const queueItems = prepareVideosForQueue(selectedPlaylist.videos)
    onImportVideos(queueItems, selectedPlaylist.playlist.title)
    
    toast({
      title: "재생목록 가져오기 완료",
      description: `"${selectedPlaylist.playlist.title}"에서 ${selectedPlaylist.videos.length}개 영상을 큐에 추가했습니다.`,
    })
    
    // 상태 초기화
    setSelectedPlaylist(null)
    setPlaylistUrl('')
    setIsOpen(false)
  }

  const handleDialogOpenChange = (open: boolean) => {
    setIsOpen(open)
    if (open) {
      clearError()
      setActiveTab('url')
    } else {
      setSelectedPlaylist(null)
      setPlaylistUrl('')
      clearError()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <List className="w-4 h-4 mr-2" />
          재생목록 가져오기
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="w-5 h-5 text-red-500" />
            YouTube 재생목록 가져오기
          </DialogTitle>
          <DialogDescription>
            공개 재생목록 URL을 입력하거나, 로그인 시 개인 재생목록에서 선택할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="url">URL 입력</TabsTrigger>
            <TabsTrigger value="myplaylists" disabled={!user}>
              내 재생목록 {!user && <Lock className="w-3 h-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="preview" disabled={!selectedPlaylist}>미리보기</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="playlist-url">재생목록 URL</Label>
              <div className="flex gap-2">
                <Input
                  id="playlist-url"
                  placeholder="https://www.youtube.com/playlist?list=..."
                  value={playlistUrl}
                  onChange={(e) => setPlaylistUrl(e.target.value)}
                  disabled={loading}
                />
                <Button onClick={handleFetchPlaylist} disabled={loading || !playlistUrl.trim()}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  로드
                </Button>
              </div>
            </div>
            {error && (
              <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
                {error}
              </div>
            )}
          </TabsContent>

          <TabsContent value="myplaylists" className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Google 계정의 재생목록을 불러옵니다.
              </p>
              <Button onClick={handleLoadMyPlaylists} disabled={loading} size="sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <User className="w-4 h-4" />}
                내 재생목록 로드
              </Button>
            </div>
            
            <ScrollArea className="h-[400px]">
              <div className="space-y-3">
                {myPlaylists.map((playlist) => (
                  <Card 
                    key={playlist.id} 
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectMyPlaylist(playlist)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        {playlist.thumbnail && (
                          <img 
                            src={playlist.thumbnail} 
                            alt={playlist.title}
                            className="w-16 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{playlist.title}</h3>
                          <p className="text-sm text-muted-foreground truncate">
                            {playlist.description || '설명 없음'}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="secondary" className="text-xs">
                              <PlayCircle className="w-3 h-3 mr-1" />
                              {playlist.itemCount}개 영상
                            </Badge>
                            <Badge variant={playlist.privacy === 'public' ? 'default' : 'secondary'} className="text-xs">
                              {playlist.privacy === 'public' ? <Globe className="w-3 h-3 mr-1" /> : <Lock className="w-3 h-3 mr-1" />}
                              {playlist.privacy === 'public' ? '공개' : '비공개'}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {myPlaylists.length === 0 && !loading && (
                  <div className="text-center py-8 text-muted-foreground">
                    <List className="w-12 h-12 mx-auto mb-4 opacity-30" />
                    <p>재생목록이 없습니다.</p>
                    <p className="text-sm mt-1">먼저 "내 재생목록 로드" 버튼을 클릭해주세요.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="preview" className="space-y-4">
            {selectedPlaylist && (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-start gap-4">
                      {selectedPlaylist.playlist.thumbnail && (
                        <img 
                          src={selectedPlaylist.playlist.thumbnail} 
                          alt={selectedPlaylist.playlist.title}
                          className="w-24 h-18 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <CardTitle className="text-lg">{selectedPlaylist.playlist.title}</CardTitle>
                        <CardDescription className="mt-2">
                          {selectedPlaylist.playlist.description || '설명 없음'}
                        </CardDescription>
                        <div className="flex items-center gap-4 mt-3">
                          <Badge>
                            <PlayCircle className="w-3 h-3 mr-1" />
                            {selectedPlaylist.videos.length}개 영상
                          </Badge>
                          <Badge variant="secondary">
                            <Clock className="w-3 h-3 mr-1" />
                            {new Date(selectedPlaylist.playlist.publishedAt).toLocaleDateString()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium">영상 목록</h3>
                  <Button onClick={handleImportPlaylist}>
                    <Download className="w-4 h-4 mr-2" />
                    큐에 추가 ({selectedPlaylist.videos.length}개)
                  </Button>
                </div>

                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {selectedPlaylist.videos.map((video, index) => (
                      <div key={video.id} className="flex items-start gap-3 p-3 rounded-lg border">
                        <Badge variant="outline" className="mt-1 min-w-[2rem] justify-center">
                          {index + 1}
                        </Badge>
                        {video.thumbnail && (
                          <img 
                            src={video.thumbnail} 
                            alt={video.title}
                            className="w-20 h-15 object-cover rounded"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{video.title}</h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {video.description || '설명 없음'}
                          </p>
                          <a 
                            href={video.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mt-1"
                          >
                            YouTube에서 보기 <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
} 