import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BudgetPolicies() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Politiques budgétaires</CardTitle>
        <CardDescription>Configurer les règles budgétaires</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12 text-muted-foreground">
          <p>Configuration des politiques budgétaires</p>
        </div>
      </CardContent>
    </Card>
  );
}
