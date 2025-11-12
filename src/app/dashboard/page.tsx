'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useProgress } from '@/hooks/useProgress';
import { useCommunity } from '@/hooks/useCommunity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertCircle, TrendingUp, Users, Target, Award, MessageCircle, Calendar, Heart } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Layout } from '@/components/layout/Layout';

export default function DashboardPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('user_demo'); // In real app, get from auth
  const [activeTab, setActiveTab] = useState('overview');
  const { dashboard, isLoading: progressLoading, error: progressError, refreshDashboard } = useProgress({ userId });
  const { profile, supportMatches, supportNetwork, isLoading: communityLoading, error: communityError } = useCommunity({ userId });

  if (progressLoading || communityLoading) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
            <div className="h-96 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
          </div>
        </div>
      </Layout>
    );
  }

  if (progressError || communityError) {
    return (
      <Layout>
        <div className="max-w-7xl mx-auto p-6">
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {progressError || communityError}
              <Button
                variant="outline"
                size="sm"
                className="ml-2"
                onClick={() => {
                  refreshDashboard();
                  window.location.reload();
                }}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Welcome back, {profile?.displayName || 'Friend'}</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Here's your mental health journey overview</p>
          </div>
          <Button onClick={() => refreshDashboard()} variant="outline" className="dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700">
            Refresh Dashboard
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="dark:bg-gray-800 dark:border-gray-700">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium dark:text-white">Current Streak</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold dark:text-white">{dashboard?.overview.currentStreak || 0}</div>
              <p className="text-xs text-muted-foreground">
                Longest: {dashboard?.overview.longestStreak || 0} days
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Goals Completed</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{dashboard?.overview.goalsCompleted || 0}</div>
              <p className="text-xs text-muted-foreground">
                This month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Emotional Wellbeing</CardTitle>
              <Heart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {dashboard?.overview.avgEmotionalWellbeing
                  ? Math.round(dashboard.overview.avgEmotionalWellbeing * 100)
                  : 0}%
              </div>
              <Progress
                value={dashboard?.overview.avgEmotionalWellbeing ? dashboard.overview.avgEmotionalWellbeing * 100 : 0}
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Support Network</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{supportNetwork?.connections.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Active connections
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="progress">Progress</TabsTrigger>
            <TabsTrigger value="community">Community</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest progress and achievements</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboard?.insights.recent.slice(0, 3).map((insight) => (
                    <div key={insight.id} className="flex items-start space-x-3">
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        insight.type === 'positive' ? 'bg-green-500' :
                        insight.type === 'concern' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <div className="flex-1">
                        <p className="text-sm font-medium">{insight.title}</p>
                        <p className="text-xs text-muted-foreground">{insight.description}</p>
                      </div>
                    </div>
                  ))}
                  {(!dashboard?.insights.recent || dashboard.insights.recent.length === 0) && (
                    <p className="text-sm text-muted-foreground">No recent activity to show</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                  <CardDescription>Common tasks and resources</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                   <Button
                     className="w-full justify-start"
                     variant="outline"
                     onClick={() => router.push('/chat')}
                   >
                     <MessageCircle className="mr-2 h-4 w-4" />
                     Start a Conversation
                   </Button>
                   <Button
                     className="w-full justify-start"
                     variant="outline"
                     onClick={() => setActiveTab('progress')}
                   >
                     <Target className="mr-2 h-4 w-4" />
                     Set New Goal
                   </Button>
                   <Button
                     className="w-full justify-start"
                     variant="outline"
                     onClick={() => setActiveTab('community')}
                   >
                     <Calendar className="mr-2 h-4 w-4" />
                     Join Community Event
                   </Button>
                   <Button
                     className="w-full justify-start"
                     variant="outline"
                     onClick={() => setActiveTab('community')}
                   >
                     <Users className="mr-2 h-4 w-4" />
                     Find Peer Support
                   </Button>
                 </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="progress" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Progress Overview</CardTitle>
                <CardDescription>Your journey metrics and trends</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Weekly Progress</span>
                      <span>{Math.round((dashboard?.overview.weeklyProgress || 0) * 100)}%</span>
                    </div>
                    <Progress value={(dashboard?.overview.weeklyProgress || 0) * 100} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {dashboard?.overview.goalsCompleted || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Goals Completed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {dashboard?.overview.achievementsUnlocked || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">Achievements</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="community" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Support Matches */}
              <Card>
                <CardHeader>
                  <CardTitle>Peer Support Matches</CardTitle>
                  <CardDescription>People who can support your journey</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {supportMatches.slice(0, 3).map((match) => (
                    <div key={match.matchedUserId} className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>{match.matchedUserId.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Support Match</p>
                        <p className="text-xs text-muted-foreground">
                          {Math.round(match.matchScore * 100)}% compatibility
                        </p>
                      </div>
                      <Badge variant="secondary">
                        {match.recommendedSessionType}
                      </Badge>
                    </div>
                  ))}
                  {supportMatches.length === 0 && (
                    <p className="text-sm text-muted-foreground">No support matches available</p>
                  )}
                </CardContent>
              </Card>

              {/* Network Strength */}
              <Card>
                <CardHeader>
                  <CardTitle>Support Network</CardTitle>
                  <CardDescription>Your community connections</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>Network Strength</span>
                        <span>{Math.round((supportNetwork?.networkStrength || 0) * 100)}%</span>
                      </div>
                      <Progress value={(supportNetwork?.networkStrength || 0) * 100} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-lg font-semibold">{supportNetwork?.connections.length || 0}</div>
                        <div className="text-xs text-muted-foreground">Connections</div>
                      </div>
                      <div>
                        <div className="text-lg font-semibold">
                          {Math.round((supportNetwork?.diversityScore || 0) * 100)}%
                        </div>
                        <div className="text-xs text-muted-foreground">Diversity</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Actionable Insights */}
              <Card>
                <CardHeader>
                  <CardTitle>Actionable Insights</CardTitle>
                  <CardDescription>Recommendations to improve your wellbeing</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {dashboard?.insights.actionable.map((insight) => (
                    <Alert key={insight.id}>
                      <TrendingUp className="h-4 w-4" />
                      <AlertDescription>
                        <div className="font-medium">{insight.title}</div>
                        <div className="text-sm mt-1">{insight.description}</div>
                      </AlertDescription>
                    </Alert>
                  ))}
                  {(!dashboard?.insights.actionable || dashboard.insights.actionable.length === 0) && (
                    <p className="text-sm text-muted-foreground">No actionable insights available</p>
                  )}
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle>Recommendations</CardTitle>
                  <CardDescription>Personalized suggestions for your journey</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {dashboard?.recommendations.map((rec, index) => (
                      <div key={index} className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm">{rec}</p>
                      </div>
                    ))}
                    {(!dashboard?.recommendations || dashboard.recommendations.length === 0) && (
                      <p className="text-sm text-muted-foreground">No recommendations available</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}